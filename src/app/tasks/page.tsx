"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CreateTaskForm from "@/components/CreateTaskForm";

const STATUS_LABELS: any = {
  PENDING: "В ожидании",
  CLARIFICATION: "На уточнении",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  IN_REVIEW: "На проверке",
  IN_PUBLICATION: "На публикации",
  PUBLISHED_NO_HW: "Опубликовано без ДЗ",
  PUBLISHED_NO_HW_PRO: "Опубликовано без ДЗ Pro",
  REWORKING: "На доработке",
  COMPLETED: "Завершена",
};

const UNIT_LABELS: Record<string, string> = {
  HOURS: "ч.",
  UNITS: "шт.",
  DAYS: "дн.",
  FIX: "фикс"
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executors, setExecutors] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [directions, setDirections] = useState<any[]>([]);
  
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [filters, setFilters] = useState<any>({
    search: "",
    status: "", // Backend handles empty status by excluding REJECTED/COMPLETED
    responsible: "",
    typeId: "",
    directionId: "",
    createdFrom: "",
    createdTo: "",
    deadlineFrom: "",
    deadlineTo: "",
    sortBy: "deadline",
    sortOrder: "asc",
  });

  const fetchTasks = async (page = 1) => {
    setLoading(true);
    try {
      const activeFilters = { ...filters };
      const params = new URLSearchParams({
        ...activeFilters,
        page: page.toString(),
        limit: pagination.limit.toString()
      }).toString();
      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks(1);
  }, [filters]);

  useEffect(() => {
    fetch("/api/users?limit=1000").then(res => res.json()).then(data => 
      setExecutors((data.users || []).filter((u: any) => u.role === "EXECUTOR"))
    );
    fetch("/api/task-types").then(res => res.json()).then(setTypes);
    fetch("/api/task-directions").then(res => res.json()).then(setDirections);
  }, []);

  const handleSort = (field: string) => {
    if (filters.sortBy === field) {
      setFilters({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ ...filters, sortBy: field, sortOrder: "asc" });
    }
  };

  const renderSortIndicator = (field: string) => {
    if (filters.sortBy !== field) return null;
    return filters.sortOrder === "asc" ? " ▴" : " ▾";
  };

  const exportToCSV = () => {
    const headers = ["ID", "Название", "Тип", "Направления", "Статус", "Дедлайн", "Дата создания", "Создатель", "Ответственные", "Затрачено"];
    const rows = tasks.map((task: any) => [
      `"${task.id}"`,
      `"${task.title.replace(/"/g, '""')}"`,
      `"${task.type?.name || ''}"`,
      `"${task.directions?.map((d: any) => d.direction.name).join(", ") || ""}"`,
      `"${STATUS_LABELS[task.status] || task.status}"`,
      `"${new Date(task.deadline).toLocaleDateString()}"`,
      `"${new Date(task.createdAt).toLocaleDateString()}"`,
      `"${task.creator?.fullName || ''}"`,
      `"${task.assignees?.map((a: any) => a.user.fullName).join(", ") || "Нет"}"`,
      `"${task.spent?.map((s: any) => `${s.volume} ${UNIT_LABELS[s.unit] || s.unit}`).join("; ") || "0"}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Задачи</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={exportToCSV}>Экспорт CSV</button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Создать задачу</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label>Поиск</label>
            <input 
              placeholder="Название или описание..." 
              value={filters.search} 
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Статус</label>
            <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
              <option value="">Активные (без Откл/Заверш)</option>
              {Object.entries(STATUS_LABELS).map(([value, label]: any) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Ответственный</label>
            <select value={filters.responsible} onChange={(e) => setFilters({...filters, responsible: e.target.value})}>
              <option value="">Все ответственные</option>
              {executors.map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Тип</label>
            <select value={filters.typeId} onChange={(e) => setFilters({...filters, typeId: e.target.value})}>
              <option value="">Все типы</option>
              {types.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label>Дата создания</label>
            <DatePicker
              selectsRange={true}
              startDate={filters.createdFrom ? new Date(filters.createdFrom + 'T00:00:00') : null}
              endDate={filters.createdTo ? new Date(filters.createdTo + 'T00:00:00') : null}
              onChange={(update: any) => {
                const [start, end] = update;
                const formatDate = (d: Date | null) => d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                setFilters({...filters,
                  createdFrom: start ? formatDate(start) : '',
                  createdTo: end ? formatDate(end) : ''
                });
              }}
              isClearable
              placeholderText="Выберите период"
              className="date-picker-input"
              dateFormat="dd.MM.yyyy"
            />
          </div>
          <div className="form-group">
            <label>Дедлайн</label>
            <DatePicker
              selectsRange={true}
              startDate={filters.deadlineFrom ? new Date(filters.deadlineFrom + 'T00:00:00') : null}
              endDate={filters.deadlineTo ? new Date(filters.deadlineTo + 'T00:00:00') : null}
              onChange={(update: any) => {
                const [start, end] = update;
                const formatDate = (d: Date | null) => d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                setFilters({...filters,
                  deadlineFrom: start ? formatDate(start) : '',
                  deadlineTo: end ? formatDate(end) : ''
                });
              }}
              isClearable
              placeholderText="Выберите период"
              className="date-picker-input"
              dateFormat="dd.MM.yyyy"
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>Название{renderSortIndicator('title')}</th>
              <th onClick={() => handleSort('deadline')} style={{ cursor: 'pointer', userSelect: 'none' }}>Дедлайн{renderSortIndicator('deadline')}</th>
              <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>Создана{renderSortIndicator('createdAt')}</th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Статус{renderSortIndicator('status')}</th>
              <th>Затрачено</th>
              <th>Ответственные</th>
              <th>Создатель</th>
            </tr>
          </thead>
          <tbody>
            {!loading && tasks.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Задачи не найдены</td></tr>
            ) : (
              tasks.map((task: any) => (
                <tr key={task.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '100px' }}>
                    #{task.id}
                  </td>
                  <td>
                    <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                      {task.title}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.type?.name}</div>
                  </td>
                  <td>{new Date(task.deadline).toLocaleDateString()}</td>
                  <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge badge-${task.status.toLowerCase().replace('_', '-')}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </td>
                  <td>
                    {task.spent?.map((s: any, idx: number) => (
                      <div key={idx}>{s.volume} {UNIT_LABELS[s.unit] || s.unit}</div>
                    )) || "0"}
                  </td>
                  <td>
                    {task.assignees.map((a: any) => a.user.fullName).join(", ") || "Нет"}
                  </td>
                  <td>{task.creator?.fullName || '—'}</td>
                </tr>
              ))
            )}
            {loading && <tr><td colSpan={8} style={{ textAlign: 'center' }}>Загрузка...</td></tr>}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === 1} 
            onClick={() => fetchTasks(pagination.page - 1)}
          >
            Назад
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)' }}>
            Страница {pagination.page} из {pagination.totalPages}
          </span>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === pagination.totalPages} 
            onClick={() => fetchTasks(pagination.page + 1)}
          >
            Вперед
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            <div className="modal-body">
              <CreateTaskForm onCreated={() => {
                setShowCreateModal(false);
                fetchTasks(1);
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
