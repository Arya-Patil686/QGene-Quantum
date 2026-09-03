"""
Quantum feature maps, kernels and a variational classifier -- implemented as
batched statevector algebra.

Why not use `FidelityQuantumKernel` directly?
--------------------------------------------
Qiskit's fidelity kernel evaluates one circuit per *pair* of samples, so
building an n x n Gram matrix costs O(n^2) circuit simulations. For n = 500
that is 125,000 simulations, which is why the original QGene could only train
its QSVM on 500 samples and needed ~3 s per web request.

Under statevector simulation the fidelity kernel has a closed form:

    K(x, y) = |<phi(x)|phi(y)>|^2

so it is enough to prepare each state *once* -- O(n) simulations -- and take a
single Gram product. That is exactly what `zz_statevectors` + `kernel_matrix`
do here. The result is numerically identical to Qiskit's (verified in
`verify_against_qiskit`), and it is what allows this project to train the QSVM
on the full training set and answer a prediction in well under a millisecond.

The ZZFeatureMap itself is also written out analytically. After the Hadamard
layer the whole block is diagonal, so a rep is

    |psi> <- D(x) H^{(x)n} |psi>,    D(x)|b> = e^{i phi(x, b)} |b>
    phi(x, b) = 2 sum_i x_i b_i + 2 sum_{i<j} (pi - x_i)(pi - x_j) (b_i XOR b_j)

which vectorises over the whole batch at once.
"""
from __future__ import annotations

import itertools

import numpy as np


def _bit_table(n_qubits: int) -> np.ndarray:
    """(2^n, n) table of basis-state bits, little-endian like Qiskit."""
    dim = 1 << n_qubits
    b = np.arange(dim)
    return np.stack([(b >> q) & 1 for q in range(n_qubits)], axis=1).astype(float)


def _hadamard_all(state: np.ndarray, n_qubits: int) -> np.ndarray:
    """Apply H on every qubit to a batch of states, shape (batch, 2^n)."""
    batch = state.shape[0]
    s = state.reshape((batch,) + (2,) * n_qubits)
    inv_sqrt2 = 1.0 / np.sqrt(2.0)
    for q in range(n_qubits):
        axis = n_qubits - q  # axis 0 is the batch
        s = np.moveaxis(s, axis, -1)
        a, b = s[..., 0], s[..., 1]
        s = np.stack([(a + b) * inv_sqrt2, (a - b) * inv_sqrt2], axis=-1)
        s = np.moveaxis(s, -1, axis)
    return s.reshape(batch, 1 << n_qubits)


def zz_statevectors(X: np.ndarray, reps: int = 2) -> np.ndarray:
    """
    Statevectors produced by ZZFeatureMap(n_features, reps) for a batch of
    inputs. Returns a complex array of shape (n_samples, 2^n_features).
    """
    X = np.asarray(X, dtype=float)
    n_samples, n_qubits = X.shape
    dim = 1 << n_qubits
    bits = _bit_table(n_qubits)                       # (dim, n)

    # Single-qubit phase contribution: 2 * sum_i x_i b_i
    single = 2.0 * (X @ bits.T)                       # (n_samples, dim)

    # Pairwise contribution: 2 * sum_{i<j} (pi - x_i)(pi - x_j) * (b_i XOR b_j)
    pair = np.zeros((n_samples, dim))
    for i, j in itertools.combinations(range(n_qubits), 2):
        coeff = 2.0 * (np.pi - X[:, i]) * (np.pi - X[:, j])      # (n_samples,)
        xor = np.abs(bits[:, i] - bits[:, j])                    # (dim,)
        pair += np.outer(coeff, xor)

    phase = np.exp(1j * (single + pair))              # (n_samples, dim)

    state = np.zeros((n_samples, dim), dtype=complex)
    state[:, 0] = 1.0
    for _ in range(reps):
        state = _hadamard_all(state, n_qubits)
        state = state * phase
    return state


def kernel_matrix(psi_a: np.ndarray, psi_b: np.ndarray | None = None) -> np.ndarray:
    """Fidelity kernel |<phi(x)|phi(y)>|^2 from prepared statevectors."""
    if psi_b is None:
        psi_b = psi_a
    overlap = psi_a @ psi_b.conj().T
    return np.abs(overlap) ** 2


def verify_against_qiskit(n_qubits: int = 4, reps: int = 2, n: int = 6,
                          seed: int = 0) -> float:
    """
    Cross-check the analytic construction against Qiskit's own simulator.
    Returns the maximum absolute deviation of the two kernel matrices.
    """
    from qiskit.circuit.library import ZZFeatureMap
    from qiskit.quantum_info import Statevector

    rng = np.random.default_rng(seed)
    X = rng.uniform(0, np.pi, size=(n, n_qubits))

    fmap = ZZFeatureMap(feature_dimension=n_qubits, reps=reps)
    ref = np.stack([
        Statevector.from_instruction(fmap.assign_parameters(x)).data for x in X
    ])
    ours = zz_statevectors(X, reps=reps)
    return float(np.abs(kernel_matrix(ref) - kernel_matrix(ours)).max())


# ---------------------------------------------------------------------------
# Variational Quantum Classifier
# ---------------------------------------------------------------------------

class StatevectorVQC:
    """
    A VQC with a ZZFeatureMap encoder and a RealAmplitudes ansatz, trained by
    batched statevector simulation.

    The feature map does not depend on the parameters, so every training
    state is prepared exactly once. Each optimiser step is then a single
    (n x 2^q) @ (2^q x 2^q) product against the ansatz unitary, which is what
    makes it practical to fit the full training set rather than a 200-sample
    subset.
    """

    def __init__(self, n_qubits: int = 4, feature_reps: int = 2,
                 ansatz_reps: int = 3, seed: int = 42):
        self.n_qubits = n_qubits
        self.feature_reps = feature_reps
        self.ansatz_reps = ansatz_reps
        self.seed = seed
        self.theta_: np.ndarray | None = None
        self.bias_: float = 0.0
        self.scale_: float = 1.0
        self._parity = self._parity_signs(n_qubits)

    @staticmethod
    def _parity_signs(n_qubits: int) -> np.ndarray:
        """+1 / -1 per basis state according to bit parity."""
        b = np.arange(1 << n_qubits)
        popcount = np.zeros_like(b)
        v = b.copy()
        while v.any():
            popcount += v & 1
            v >>= 1
        return np.where(popcount % 2 == 0, 1.0, -1.0)

    def _ansatz_unitary(self, theta: np.ndarray) -> np.ndarray:
        from qiskit.circuit.library import RealAmplitudes
        from qiskit.quantum_info import Operator
        circ = RealAmplitudes(self.n_qubits, reps=self.ansatz_reps)
        return np.asarray(Operator(circ.assign_parameters(theta)).data)

    @property
    def n_params(self) -> int:
        return self.n_qubits * (self.ansatz_reps + 1)

    def _expectation(self, psi: np.ndarray, theta: np.ndarray) -> np.ndarray:
        u = self._ansatz_unitary(theta)
        out = psi @ u.T
        probs = np.abs(out) ** 2
        return probs @ self._parity          # in [-1, 1]

    def _decision(self, psi: np.ndarray, theta: np.ndarray) -> np.ndarray:
        return self.scale_ * self._expectation(psi, theta) + self.bias_

    def fit(self, X: np.ndarray, y: np.ndarray, maxiter: int = 400,
            verbose: bool = False) -> "StatevectorVQC":
        from scipy.optimize import minimize

        psi = zz_statevectors(X, reps=self.feature_reps)
        y = np.asarray(y, dtype=float)
        rng = np.random.default_rng(self.seed)
        theta0 = rng.uniform(-np.pi, np.pi, size=self.n_params)
        history: list[float] = []

        def loss(theta: np.ndarray) -> float:
            z = self._expectation(psi, theta)
            p = np.clip(0.5 * (1.0 + z), 1e-9, 1 - 1e-9)
            nll = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
            history.append(float(nll))
            return nll

        res = minimize(loss, theta0, method="COBYLA",
                       options={"maxiter": maxiter, "rhobeg": 0.5})
        self.theta_ = res.x
        self.loss_history_ = history

        # Fit a 1-D logistic calibration on the raw expectation value so the
        # network's output can be read as a probability.
        from sklearn.linear_model import LogisticRegression
        z = self._expectation(psi, self.theta_).reshape(-1, 1)
        lr = LogisticRegression().fit(z, y)
        self.scale_ = float(lr.coef_[0, 0])
        self.bias_ = float(lr.intercept_[0])
        if verbose:
            print(f"    VQC converged: loss {history[0]:.4f} -> {history[-1]:.4f} "
                  f"in {len(history)} evaluations")
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        psi = zz_statevectors(X, reps=self.feature_reps)
        d = self._decision(psi, self.theta_)
        p1 = 1.0 / (1.0 + np.exp(-d))
        return np.stack([1 - p1, p1], axis=1)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] > 0.5).astype(int)


def bloch_coordinates(x: np.ndarray, reps: int = 2) -> list[dict]:
    """
    Reduced single-qubit Bloch vectors for one encoded sample, for display.
    Each qubit's reduced density matrix gives (<X>, <Y>, <Z>).
    """
    psi = zz_statevectors(np.asarray(x, dtype=float).reshape(1, -1), reps=reps)[0]
    n_qubits = int(np.log2(psi.size))
    coords = []
    for q in range(n_qubits):
        s = psi.reshape((2,) * n_qubits)
        axis = n_qubits - 1 - q
        s = np.moveaxis(s, axis, 0).reshape(2, -1)
        rho = s @ s.conj().T
        coords.append({
            "qubit": q,
            "x": float(2 * np.real(rho[0, 1])),
            "y": float(2 * np.imag(rho[1, 0])),
            "z": float(np.real(rho[0, 0] - rho[1, 1])),
            "purity": float(np.real(np.trace(rho @ rho))),
        })
    return coords
