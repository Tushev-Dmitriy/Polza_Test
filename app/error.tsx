"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="errorPage">
      <p className="eyebrow dark">Ошибка подключения</p>
      <h1>Не удалось загрузить компании</h1>
      <p>Проверьте, что PostgreSQL запущен и переменная DATABASE_URL настроена.</p>
      <button type="button" onClick={reset}>Попробовать снова</button>
    </main>
  );
}
