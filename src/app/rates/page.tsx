"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function RatesPage() {
  const { data: session } = useSession();
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    executorId: "",
    typeId: "",
    unit: ""
  });

  const [sortConfig, setSortConfig] = useState({
    key: "startDate",
    direction: "desc"
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 0 });

  const [formState, setFormState] = useState({
    executorId: "",
    typeId: "",
    rate: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    unit: "HOURS",
    comment: ""
  });

  const unitLabels: Record<string, string> = {
    HOURS: "Час",
    UNITS: "Шт.",
    DAYS: "День",
    FIX: "Фикс"
  };

  const fetchRates = async (page = 1) => {
    setLoading(true);
    const query = new URLSearchParams({
      ...filters,
      sortBy: sortConfig.key,
      sortOrder: sortConfig.direction,
      page: page.toString(),
      limit: pagination.limit.toString()
    }).toString();
    const res = await fetch(`/api/rates?${query}`);
    const data = await res.json();
    setRates(data.rates || []);
    setPagination(data.pagination || { total: 0, page: 1, limit: 15, totalPages: 0 });
    setLoading(false);
  };

  const fetchData = async () => {
    const [uRes, tRes] = await Promise.all([
      fetch("/api/users?limit=1000"),
      fetch("/api/task-types")
    ]);
    const uData = await uRes.json();
    const tData = await tRes.json();
    setUsers(uData.users || []);
    setTypes(tData);
  };

  useEffect(() => {
    fetchRates();
  }, [filters, sortConfig]);

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

  useEffect(() => {
    if ((session?.user as any)?.role === "ADMIN") {
      fetchData();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingRate;
    const url = isEdit ? `/api/rates/${editingRate.id}` : "/api/rates";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });

    if (res.ok) {
      closeModal();
      fetchRates();
    } else {
      let errorMessage = "Ошибка при сохранении ставки";
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {}
      alert(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту ставку?")) return;
    const res = await fetch(`/api/rates/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchRates();
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка при удалении");
    }
  };

  const openAddModal = () => {
    setEditingRate(null);
    setFormState({
      executorId: "",
      typeId: "",
      rate: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      unit: "HOURS",
      comment: ""
    });
    setShowModal(true);
  };

  const openEditModal = (rate: any) => {
    setEditingRate(rate);
    setFormState({
      executorId: rate.executorId,
      typeId: rate.typeId,
      rate: rate.rate.toString(),
      startDate: new Date(rate.startDate).toISOString().split('T')[0],
      endDate: rate.endDate ? new Date(rate.endDate).toISOString().split('T')[0] : "",
      unit: rate.unit,
      comment: rate.comment || ""
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRate(null);
  };

  if (!session || !["ADMIN", "UCH"].includes((session.user as any).role)) return <div>Нет доступа</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Зарплатные ставки</h1>
        {(session?.user as any).role === "ADMIN" && (
          <button className="btn-primary" onClick={openAddModal}>+ Добавить ставку</button>
        )}
      </div>

      {/* Filters Section */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label>Исполнитель</label>
            <select value={filters.executorId} onChange={e => setFilters({...filters, executorId: e.target.value})}>
              <option value="">Все исполнители</option>
              {users.filter(u => u.role === "EXECUTOR").map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Тип задачи</label>
            <select value={filters.typeId} onChange={e => setFilters({...filters, typeId: e.target.value})}>
              <option value="">Все типы</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Ед. изм.</label>
            <select value={filters.unit} onChange={e => setFilters({...filters, unit: e.target.value})}>
              <option value="">Все единицы</option>
              {Object.entries(unitLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
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
              <th onClick={() => handleSort("type")} style={{ cursor: 'pointer' }}>Тип задачи {getSortIcon("type")}</th>
              <th onClick={() => handleSort("rate")} style={{ cursor: 'pointer' }}>Ставка {getSortIcon("rate")}</th>
              <th onClick={() => handleSort("unit")} style={{ cursor: 'pointer' }}>Ед. изм. {getSortIcon("unit")}</th>
              <th onClick={() => handleSort("startDate")} style={{ cursor: 'pointer' }}>Период {getSortIcon("startDate")}</th>
              <th>Комментарий</th>
              {(session?.user as any).role === "ADMIN" && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Загрузка...</td></tr>
            ) : rates.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Ставки не найдены</td></tr>
            ) : (
              rates.map(rate => (
                <tr key={rate.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '100px' }}>
                    #{rate.id}
                  </td>
                  <td style={{ fontWeight: 500 }}>{rate.executor.fullName}</td>
                  <td><span className="badge badge-in-progress" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>{rate.type.name}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(rate.rate).toFixed(2)} ₽</td>
                  <td>{unitLabels[rate.unit] || rate.unit}</td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {new Date(rate.startDate).toLocaleDateString()} — {rate.endDate ? new Date(rate.endDate).toLocaleDateString() : "∞"}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rate.comment}>
                    {rate.comment}
                  </td>
                  {(session?.user as any).role === "ADMIN" && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEditModal(rate)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Изм.</button>
                        <button onClick={() => handleDelete(rate.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}>Удалить</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === 1} 
            onClick={() => fetchRates(pagination.page - 1)}
          >
            Назад
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-muted)' }}>
            Страница {pagination.page} из {pagination.totalPages}
          </span>
          <button 
            className="btn-secondary" 
            disabled={pagination.page === pagination.totalPages} 
            onClick={() => fetchRates(pagination.page + 1)}
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
              <h2>{editingRate ? "Редактировать ставку" : "Новая ставка"}</h2>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>Исполнитель</label>
                  <select required value={formState.executorId} onChange={e => setFormState({...formState, executorId: e.target.value})}>
                    <option value="">Выберите исполнителя...</option>
                    {users.filter(u => u.role === "EXECUTOR").map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Тип задачи</label>
                  <select required value={formState.typeId} onChange={e => setFormState({...formState, typeId: e.target.value})}>
                    <option value="">Выберите тип...</option>
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Размер ставки (руб.)</label>
                    <input type="number" step="0.01" required value={formState.rate} onChange={e => setFormState({...formState, rate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Единица измерения</label>
                    <select value={formState.unit} onChange={e => setFormState({...formState, unit: e.target.value})}>
                      {Object.entries(unitLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Дата начала</label>
                    <input type="date" required value={formState.startDate} onChange={e => setFormState({...formState, startDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Дата окончания</label>
                    <input type="date" value={formState.endDate} onChange={e => setFormState({...formState, endDate: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Комментарий (макс. 500 симв.)</label>
                  <textarea 
                    value={formState.comment} 
                    onChange={e => setFormState({...formState, comment: e.target.value.substring(0, 500)})} 
                    placeholder="Дополнительная информация"
                    rows={3}
                    style={{ resize: 'vertical', width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'white' }}
                  />
                  <small style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{formState.comment.length}/500</small>
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
