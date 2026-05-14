export function App() {
  const modules = [
    "Trade Registry",
    "Valuation",
    "Performance Analytics",
  ];

  return (
    <main className="page">
      <section className="hero">
        <h1>Portfolio Platform</h1>
        <p>
          Phase 1 scaffold is ready. Domain modules and workflows are prepared for
          implementation.
        </p>
      </section>

      <section className="card-grid">
        {modules.map((module) => (
          <article key={module} className="card">
            <h2>{module}</h2>
            <p>Planned and ready for domain implementation in next phases.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
