"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
  };
}

export default function LogsPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    entity: "",
    entityId: "",
    startDate: "",
    endDate: "",
  });
  const [users, setUsers] = useState<any[]>([]);

  const fetchUsers = async () => {
    const res = await fetch("/api/users?limit=100");
    const data = await res.json();
    setUsers(data.users || []);
  };

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: pagination?.limit?.toString() || "20",
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      });

      const res = await fetch(`/api/logs?${query}`);
      const data = await res.json();
      if (data.error) {
        console.error("Logs fetch error:", data.error);
        setLoading(false);
        return;
      }
      setLogs(data.logs || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user && (session.user as any).role === "ADMIN") {
      fetchLogs(1);
      fetchUsers();
    }
  }, [session]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => {
    fetchLogs(1);
  };

  const exportToCSV = () => {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      limit: "1000", // Export more logs
    });

    fetch(`/api/logs?${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert("Ошибка экспорта: " + data.error);
          return;
        }
        const rows = data.logs.map((log: AuditLog) => [
          format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss"),
          log.user?.fullName || "Неизвестно",
          log.action,
          log.entity,
          log.entityId || "",
          log.details || ""
        ]);

        const csvContent = "\uFEFF" + [
          ["Дата", "Пользователь", "Действие", "Сущность", "ID Сущности", "Детали"],
          ...rows
        ].map(e => e.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(",")).join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
        link.click();
      });
  };

  const renderDetails = (detailsStr: string | null) => {
    if (!detailsStr) return "-";
    try {
      const details = JSON.parse(detailsStr);
      const { before, after } = details;

      // If it's the new format
      if (before !== undefined || after !== undefined) {
        if (!before && after) {
          return (
            <div className="details-box">
              <div className="details-label">Создано:</div>
              <pre>{JSON.stringify(after, null, 2)}</pre>
            </div>
          );
        }
        if (before && !after) {
          return (
            <div className="details-box">
              <div className="details-label">Удалено:</div>
              <pre>{JSON.stringify(before, null, 2)}</pre>
            </div>
          );
        }
        if (before && after) {
          // Find changes
          const changes: any = {};
          Object.keys(after).forEach(key => {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
              changes[key] = { from: before[key], to: after[key] };
            }
          });

          return (
            <div className="details-box">
              <div className="details-label">Изменения:</div>
              {Object.keys(changes).length > 0 ? (
                <ul className="changes-list">
                  {Object.entries(changes).map(([key, val]: [string, any]) => (
                    <li key={key}>
                      <strong>{key}</strong>: 
                      <span className="change-from">{String(val.from ?? 'null')}</span> 
                      <span className="change-arrow">→</span> 
                      <span className="change-to">{String(val.to ?? 'null')}</span>
                    </li>
                  ))}
                </ul>
              ) : <span>Метаданные обновлены</span>}
            </div>
          );
        }
      }

      // Fallback for old logs or simple format
      return <pre>{JSON.stringify(details, null, 2)}</pre>;
    } catch (e) {
      return detailsStr;
    }
  };

  return (
    <div className="container">
      <style jsx>{`
        .details-box {
          font-family: monospace;
          background: rgba(0,0,0,0.05);
          padding: 8px;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
        }
        .details-label {
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          margin-bottom: 4px;
          color: var(--text-muted);
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .changes-list {
          margin: 0;
          padding-left: 16px;
          list-style: disc;
        }
        .change-from {
          color: #e53e3e;
          text-decoration: line-through;
          margin: 0 4px;
        }
        .change-to {
          color: #38a169;
          font-weight: bold;
          margin: 0 4px;
        }
        .change-arrow {
          color: var(--text-muted);
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Логи действий</h1>
        <button className="btn-secondary" onClick={exportToCSV}>Экспорт в CSV</button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div className="form-group">
            <label>Пользователь</label>
            <select className="form-control" name="userId" value={filters.userId} onChange={handleFilterChange}>
              <option value="">Все</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Действие</label>
            <select className="form-control" name="action" value={filters.action} onChange={handleFilterChange}>
              <option value="">Все</option>
              <option value="CREATE">Создание</option>
              <option value="UPDATE">Изменение</option>
              <option value="DELETE">Удаление</option>
            </select>
          </div>
          <div className="form-group">
            <label>Сущность</label>
            <select className="form-control" name="entity" value={filters.entity} onChange={handleFilterChange}>
              <option value="">Все</option>
              <option value="User">Пользователь</option>
              <option value="Task">Задача</option>
              <option value="SalaryRate">Ставка</option>
              <option value="WorkReport">Отчет</option>
              <option value="TaskType">Тип задачи</option>
              <option value="TaskDirection">Направление</option>
            </select>
          </div>
          <div className="form-group">
            <label>ID сущности</label>
            <input 
              className="form-control" 
              name="entityId" 
              placeholder="Поиск по ID..." 
              value={filters.entityId} 
              onChange={handleFilterChange} 
            />
          </div>
          <div className="form-group">
            <label>С даты</label>
            <input type="date" className="form-control" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
          </div>
          <div className="form-group">
            <label>По дату</label>
            <input type="date" className="form-control" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
          </div>
          <button className="btn-primary" onClick={applyFilters}>Применить</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Пользователь</th>
              <th>Действие</th>
              <th>Сущность</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>Загрузка...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>Логи не найдены</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: ru })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{log.user?.fullName || "Системный"}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.user?.email || ""}</div>
                  </td>
                  <td>
                    <span className={`badge ${log.action === 'CREATE' ? 'badge-success' : log.action === 'DELETE' ? 'badge-danger' : 'badge-warning'}`}>
                      {log.action === 'CREATE' ? 'Создание' : log.action === 'DELETE' ? 'Удаление' : 'Изменение'}
                    </span>
                  </td>
                   <td style={{ minWidth: '120px' }}>
                    {log.entity}
                    {log.entityId && (
                      <div 
                        title={log.entityId}
                        style={{ 
                          fontSize: '10px', 
                          color: 'var(--text-muted)', 
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          marginTop: '4px',
                          maxWidth: '120px'
                        }}
                      >
                        #{log.entityId}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', minWidth: '300px' }}>
                    {renderDetails(log.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', gap: '8px' }}>
        <button 
          className="btn-secondary" 
          disabled={!pagination || pagination.page === 1} 
          onClick={() => fetchLogs((pagination?.page || 1) - 1)}
        >
          Назад
        </button>
        <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)' }}>
          Страница {pagination?.page || 1} из {pagination?.totalPages || 1}
        </span>
        <button 
          className="btn-secondary" 
          disabled={!pagination || pagination.page === pagination.totalPages} 
          onClick={() => fetchLogs((pagination?.page || 1) + 1)}
        >
          Вперед
        </button>
      </div>
    </div>
  );
}
