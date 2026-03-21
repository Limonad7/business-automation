"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function WorkReportsPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  
  // Filters & Pagination
  const [filters, setFilters] = useState({
    executorId: "",
    taskId: "",
    startDate: "",
    endDate: "",
    creatorId: ""
  });
  const [sortConfig, setSortConfig] = useState({ key: "recordDate", direction: "desc" });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 0 });

  const [formState, setFormState] = useState({
    executorId: "",
    taskId: "",
    volume: "",
    comment: "",
    recordDate: new Date().toISOString().split('T')[0]
  });

  const [selectedTaskUnit, setSelectedTaskUnit] = useState<string | null>(null);

  const unitLabels: Record<string, string> = {
    HOURS: "Час",
    UNITS: "Шт.",
    DAYS: "День",
    FIX: "Фикс"
  };

  const fetchReports = async (page = 1) => {
    setLoading(true);
    const query = new URLSearchParams({
      ...filters,
      sortBy: sortConfig.key,
      sortOrder: sortConfig.direction,
      page: page.toString(),
      limit: pagination.limit.toString()
    }).toString();
    const res = await fetch(`/api/work-reports?${query}`);
    const data = await res.json();
    setReports(data.reports);
    setPagination(data.pagination);
    setLoading(false);
  };

  const fetchInitialData = async () => {
    const [uRes, tRes] = await Promise.all([
      fetch("/api/users?limit=1000"),
      fetch("/api/tasks?limit=1000")
    ]);
    const uData = await uRes.json();
    const tData = await tRes.json();
    setUsers(uData.users || []);
    setTasks(tData.tasks || []);
  };

  useEffect(() => {
    fetchReports(1);
  }, [filters, sortConfig]);

  useEffect(() => {
    fetchInitialData();
  }, [session]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingReport;
    const url = isEdit ? `/api/work-reports/${editingReport.id}` : "/api/work-reports";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });

    if (res.ok) {
      closeModal();
      fetchReports(pagination.page);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "Ошибка при сохранении");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту запись?")) return;
    const res = await fetch(`/api/work-reports/${id}`, { method: "DELETE" });
    if (res.ok) fetchReports(pagination.page);
    else {
      const errorData = await res.json();
      alert(errorData.error || "Ошибка при удалении");
    }
  };

  const openAddModal = () => {
    const defaultExecutorId = (session?.user as any).role === "EXECUTOR" ? (session?.user as any).id : "";
    setEditingReport(null);
    setFormState({ 
      executorId: defaultExecutorId, 
      taskId: "", 
      volume: "", 
      comment: "", 
      recordDate: new Date().toISOString().split('T')[0] 
    });
    setSelectedTaskUnit(null);
    setShowModal(true);
  };

  const openEditModal = (report: any) => {
    setEditingReport(report);
    setFormState({
      executorId: report.executorId,
      taskId: report.taskId,
      volume: report.volume.toString(),
      comment: report.comment || "",
      recordDate: new Date(report.recordDate).toISOString().split('T')[0]
    });
    setSelectedTaskUnit(report.unitMatched);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingReport(null);
  };

  // Logic to determine available tasks based on selected executor
  const availableTasks = Array.isArray(tasks) ? tasks.filter(t => {
    const isAssigned = t.assignees?.some((a: any) => a.userId === formState.executorId);
    return isAssigned;
  }) : [];

  // When task or executor or date changes, try to find the rate and its unit
  useEffect(() => {
    const findRateAndUnit = async () => {
      if (formState.executorId && formState.taskId && Array.isArray(tasks)) {
        const selectedTask = tasks.find(t => t.id === formState.taskId);
        if (selectedTask) {
          // Fetch relevant rate
          const queryParams = new URLSearchParams({
            executorId: formState.executorId,
            typeId: selectedTask.typeId,
            date: formState.recordDate
          }).toString();
          
          const res = await fetch(`/api/rates?${queryParams}`);
          const { rates } = await res.json();
          
          // Find active rate for the selected date
          const selectedDate = new Date(formState.recordDate);
          selectedDate.setHours(0, 0, 0, 0);
          
          const activeRate = rates.find((r: any) => {
            const start = new Date(r.startDate);
            const end = r.endDate ? new Date(r.endDate) : null;
            return start <= selectedDate && (!end || end >= selectedDate);
          });

          if (activeRate) {
            setSelectedTaskUnit(activeRate.unit);
            if (activeRate.unit === "FIX") setFormState(s => ({...s, volume: "1"}));
          } else {
            setSelectedTaskUnit(null);
          }
        }
      }
    };
    findRateAndUnit();
  }, [formState.executorId, formState.taskId, formState.recordDate, tasks]);

  const exportCSV = async () => {
    const query = new URLSearchParams({...filters, limit: "10000"}).toString();
    const res = await fetch(`/api/work-reports?${query}`);
    const data = await res.json();
    const headers = ["ID", "Исполнитель", "Задача", "Дата записи", "Ед. изм.", "Объем", "К выплате", "Автор", "Комментарий"];
    const rows = data.reports.map((r: any) => [
      r.id,
      r.executor.fullName,
      `"${r.task.title}"`,
      new Date(r.recordDate).toLocaleDateString(),
      unitLabels[r.unitMatched] || r.unitMatched || "-",
      r.volume,
      r.amountCalculated !== null ? `${r.amountCalculated}` : "Ошибка подбора ставки",
      r.creator.fullName,
      `"${r.comment || ""}"`
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!session) return <div>Загрузка сессии...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Отчеты о работе</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={exportCSV}>Экспорт CSV</button>
          <button className="btn-primary" onClick={openAddModal}>+ Добавить запись</button>
        </div>
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
            <label>Задача</label>
            <select value={filters.taskId} onChange={e => setFilters({...filters, taskId: e.target.value})}>
              <option value="">Все</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>С даты</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
          </div>
          <div className="form-group">
            <label>По дату</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Автор</label>
            <select value={filters.creatorId} onChange={e => setFilters({...filters, creatorId: e.target.value})}>
              <option value="">Все</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th onClick={() => handleSort("executor")} style={{ cursor: 'pointer' }}>Исполнитель {getSortIcon("executor")}</th>
              <th onClick={() => handleSort("task")} style={{ cursor: 'pointer' }}>Задача {getSortIcon("task")}</th>
              <th onClick={() => handleSort("recordDate")} style={{ cursor: 'pointer' }}>Дата {getSortIcon("recordDate")}</th>
              <th>Ед. изм.</th>
              <th onClick={() => handleSort("volume")} style={{ cursor: 'pointer' }}>Объем {getSortIcon("volume")}</th>
              <th style={{ whiteSpace: 'nowrap' }}>К выплате</th>
              <th onClick={() => handleSort("creator")} style={{ cursor: 'pointer' }}>Автор {getSortIcon("creator")}</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center' }}>Загрузка...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>Записи не найдены</td></tr>
            ) : (
              reports.map(report => {
                const canEdit = (session.user as any).role === "ADMIN" || ((session.user as any).role === "UCH" && report.creatorId === (session.user as any).id);
                return (
                  <tr key={report.id}>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '100px' }}>
                      #{report.id}
                    </td>
                    <td style={{ fontWeight: 500 }}>{report.executor.fullName}</td>
                    <td>{report.task.title}</td>
                    <td>{new Date(report.recordDate).toLocaleDateString()}</td>
                    <td><span className="badge badge-pending" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>{unitLabels[report.unitMatched] || "-"}</span></td>
                    <td style={{ fontWeight: 600 }}>{report.volume}</td>
                    <td>
                      {report.amountCalculated !== null ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>{Number(report.amountCalculated).toFixed(2)} ₽</span>
                      ) : (
                        <span style={{ color: 'var(--error)', fontSize: '0.75rem' }}>Ошибка подбора ставки</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{report.creator.fullName}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={report.comment}>
                      {report.comment}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {canEdit && <button onClick={() => openEditModal(report)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Изм.</button>}
                        {canEdit && <button onClick={() => handleDelete(report.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}>Удалить</button>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === 1} 
            onClick={() => fetchReports(pagination.page - 1)}
          >
            Назад
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)' }}>
            Страница {pagination.page} из {pagination.totalPages}
          </span>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === pagination.totalPages} 
            onClick={() => fetchReports(pagination.page + 1)}
          >
            Вперед
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '500px' }}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <div className="modal-header">
              <h2>{editingReport ? "Редактировать запись" : "Добавить запись о работе"}</h2>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>Исполнитель</label>
                  <select 
                    required 
                    disabled={(session.user as any).role === "EXECUTOR" || !!editingReport}
                    value={formState.executorId} 
                    onChange={e => setFormState({...formState, executorId: e.target.value, taskId: ""})}
                  >
                    <option value="">Выберите исполнителя...</option>
                    {users.filter(u => u.role === "EXECUTOR").map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Задача</label>
                  <select required value={formState.taskId} onChange={e => setFormState({...formState, taskId: e.target.value})}>
                    <option value="">Выберите задачу...</option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Дата записи</label>
                    <input 
                      type="date" 
                      required 
                      value={formState.recordDate} 
                      onChange={e => setFormState({...formState, recordDate: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Ед. изм.</label>
                    <input type="text" disabled value={unitLabels[selectedTaskUnit || ""] || (selectedTaskUnit ? "Подбор..." : "Нет ставки")} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Объем работ</label>
                  <input 
                    type="text" 
                    required 
                    disabled={selectedTaskUnit === "FIX"}
                    value={formState.volume} 
                    onChange={e => setFormState({...formState, volume: e.target.value})} 
                    placeholder={selectedTaskUnit === "FIX" ? "1 (Фикс)" : "0.00"}
                  />
                </div>

                <div className="form-group">
                  <label>Комментарий (макс. 300 симв.)</label>
                  <textarea 
                    value={formState.comment} 
                    onChange={e => setFormState({...formState, comment: e.target.value.substring(0, 300)})} 
                    placeholder="Добавьте примечание к работе"
                    rows={3}
                    style={{ resize: 'vertical', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'white' }}
                  />
                  <small style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{formState.comment.length}/300</small>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>Сохранить</button>
                  <button type="button" className="btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
