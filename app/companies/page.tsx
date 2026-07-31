import Link from "next/link";
import { getCompaniesPage, PAGE_SIZE } from "@/lib/companies";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, 100);
}

function getPage(value: string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function queryHref(search: string, city: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (city) params.set("city", city);
  if (page > 1) params.set("page", String(page));
  return `/companies${params.size ? `?${params}` : ""}`;
}

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    search: getParam(params, "q"),
    city: getParam(params, "city"),
    page: getPage(getParam(params, "page")),
  };
  const { companies, count, cities, stats } = await getCompaniesPage(filters);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const hasFilters = Boolean(filters.search || filters.city);

  return (
    <main>
      <header className="hero">
        <nav className="nav" aria-label="Основная навигация">
          <Link href="/companies" className="brand">
            <span className="brandMark" aria-hidden="true">P</span>
            <span>polza<span className="brandAccent">/data</span></span>
          </Link>
          <span className="status"><i aria-hidden="true" />База подключена</span>
        </nav>

        <div className="heroContent">
          <p className="eyebrow">Единый каталог</p>
          <h1>Компании,<br /><span>с которыми можно работать.</span></h1>
          <p className="heroCopy">
            Проверенная база российских компаний — от IT-интеграторов
            до производственных предприятий.
          </p>
        </div>

        <dl className="stats">
          <div><dt>{stats.total.toLocaleString("ru-RU")}</dt><dd>компаний</dd></div>
          <div><dt>{stats.cities}</dt><dd>городов</dd></div>
          <div><dt>{stats.categories}</dt><dd>категорий</dd></div>
        </dl>
      </header>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="catalogHeading">
          <div>
            <p className="eyebrow dark">Каталог</p>
            <h2 id="catalog-title">Найдите нужную компанию</h2>
          </div>
          <p className="resultCount">
            {hasFilters ? "Найдено" : "Всего"} <strong>{count.toLocaleString("ru-RU")}</strong>
          </p>
        </div>

        <form className="filters" action="/companies" method="get">
          <label className="searchField">
            <span className="srOnly">Поиск по названию</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Название компании"
              maxLength={100}
            />
          </label>
          <label className="selectField">
            <span className="srOnly">Фильтр по городу</span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <select name="city" defaultValue={filters.city}>
              <option value="">Все города</option>
              {cities.map((city) => <option key={city}>{city}</option>)}
            </select>
          </label>
          <button type="submit">Найти</button>
          {hasFilters ? <Link className="reset" href="/companies">Сбросить</Link> : null}
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Компания</th>
                <th>Категория</th>
                <th>Город и адрес</th>
                <th>Рейтинг</th>
                <th>Контакты</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <strong>{company.name}</strong>
                    <small>{company.sourceId}</small>
                  </td>
                  <td><span className="tag">{company.category}</span></td>
                  <td>
                    <strong className="city">{company.city}</strong>
                    <small>{company.address}</small>
                  </td>
                  <td>
                    {company.rating ? (
                      <span className="rating"><b aria-hidden="true">★</b>{company.rating}</span>
                    ) : <span className="muted">—</span>}
                    <small>{company.reviewsCount} отзывов</small>
                  </td>
                  <td>
                    <div className="contacts">
                      {company.site ? (
                        <a href={company.site} target="_blank" rel="noreferrer" aria-label={`Сайт ${company.name}`}>
                          Сайт <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                      {company.phone ? <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}>{company.phone}</a> : null}
                      {!company.site && !company.phone ? <span className="muted">Нет контактов</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {companies.length === 0 ? (
            <div className="empty">
              <span aria-hidden="true">⌕</span>
              <h3>Ничего не найдено</h3>
              <p>Попробуйте изменить запрос или выбрать другой город.</p>
              <Link href="/companies">Очистить фильтры</Link>
            </div>
          ) : null}
        </div>

        {count > PAGE_SIZE ? (
          <nav className="pagination" aria-label="Пагинация">
            {currentPage > 1 ? <Link href={queryHref(filters.search, filters.city, currentPage - 1)}>← Назад</Link> : <span />}
            <span>Страница <strong>{currentPage}</strong> из {totalPages}</span>
            {currentPage < totalPages ? <Link href={queryHref(filters.search, filters.city, currentPage + 1)}>Вперёд →</Link> : <span />}
          </nav>
        ) : null}
      </section>

      <footer>
        <span>polza/data</span>
        <span>Тестовое задание · 2026</span>
      </footer>
    </main>
  );
}
