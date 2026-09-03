import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import { useSmoothScroll } from './lib/motion';

const Landing = lazy(() => import('./pages/Landing'));
const Predict = lazy(() => import('./pages/Predict'));
const Resolver = lazy(() => import('./pages/Resolver'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Method = lazy(() => import('./pages/Method'));

function Loading() {
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '.2em',
                                     textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        preparing state
      </div>
    </div>
  );
}

export default function App() {
  useSmoothScroll();
  return (
    <>
      <div className="aurora" />
      <div className="grain" />
      <Nav />
      <main>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/predict" element={<Predict />} />
            <Route path="/resolver" element={<Resolver />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/method" element={<Method />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
