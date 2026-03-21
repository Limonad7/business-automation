"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SalarySummaryItem {
  executor: string;
  executorId: string;
  month: number;
  year: number;
  total: number;
  hasError: boolean;
}

export default function SalaryPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<SalarySummaryItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    executorId: "",
    month: "",
    year: new Date().getFullYear().toString()
  });
  const [sortConfig, setSortConfig] = useState({ key: "period", direction: "desc" });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const months = [
    { value: "1", label: "Январь" },
    { value: "2", label: "Февраль" },
    { value: "3", label: "Март" },
    { value: "4", label: "Апрель" },
    { value: "5", label: "Май" },
    { value: "6", label: "Июнь" },
    { value: "7", label: "Июль" },
    { value: "8", label: "Август" },
    { value: "9", label: "Сентябрь" },
    { value: "10", label: "Октябрь" },
    { value: "11", label: "Ноябрь" },
    { value: "12", label: "Декабрь" }
  ];

  const fetchSummary = async (page = 1) => {
    setLoading(true);
    const query = new URLSearchParams({
      ...filters,
      sortBy: sortConfig.key,
      sortOrder: sortConfig.direction,
      page: page.toString(),
      limit: pagination.limit.toString()
    }).toString();
    const res = await fetch(`/api/salary-summary?${query}`);
    const data = await res.json();
    setSummary(data.summary);
    setPagination(data.pagination);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users?limit=1000");
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    if (session) {
      fetchSummary(1);
      fetchUsers();
    }
  }, [session, filters, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return "↕️";
    return sortConfig.direction === "asc" ? "🔼" : "🔽";
  };

  const exportCSV = () => {
    if (summary.length === 0) return;
    const headers = ["Исполнитель", "Период", "Сумма"];
    const rows = summary.map(item => [
      item.executor,
      `${item.month}/${item.year}`,
      item.hasError ? "Ошибка подбора ставки" : item.total.toFixed(2)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salary_payments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!session) return <div>Загрузка...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Расчет выплат</h1>
        <button className="btn-secondary" onClick={exportCSV}>Экспорт CSV</button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {(session.user as any).role !== "EXECUTOR" && (
            <div className="form-group">
              <label>Исполнитель</label>
              <select value={filters.executorId} onChange={e => setFilters({...filters, executorId: e.target.value})}>
                <option value="">Все</option>
                {users.filter(u => u.role === "EXECUTOR").map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Месяц</label>
            <select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})}>
              <option value="">Все</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Год</label>
            <input 
              type="number" 
              value={filters.year} 
              onChange={e => setFilters({...filters, year: e.target.value})} 
              placeholder="Напр. 2024"
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort("executor")} style={{ cursor: 'pointer' }}>Исполнитель {getSortIcon("executor")}</th>
              <th onClick={() => handleSort("period")} style={{ cursor: 'pointer' }}>Период {getSortIcon("period")}</th>
              <th onClick={() => handleSort("total")} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Сумма {getSortIcon("total")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ textAlign: 'center' }}>Загрузка...</td></tr>
            ) : summary.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px' }}>Записи не найдены</td></tr>
            ) : (
              summary.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{item.executor}</td>
                  <td>{`${item.month}/${item.year}`}</td>
                  <td>
                    {item.hasError ? (
                      <span style={{ color: 'var(--error)', fontSize: '0.85rem' }}>Ошибка подбора ставки</span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>{Number(item.total).toFixed(2)} ₽</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button 
          className="btn-secondary" 
          disabled={pagination.page === 1} 
          onClick={() => fetchSummary(pagination.page - 1)}
          style={{ padding: '8px 16px' }}
        >
          Назад
        </button>
        <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)' }}>
          Страница {pagination.page} из {pagination.totalPages}
        </span>
        <button 
          className="btn-secondary" 
          disabled={pagination.page === pagination.totalPages} 
          onClick={() => fetchSummary(pagination.page + 1)}
          style={{ padding: '8px 16px' }}
        >
          Вперед
        </button>
      </div>
    </div>
  );
}
