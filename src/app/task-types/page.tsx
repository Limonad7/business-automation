"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function TaskTypesPage() {
  const { data: session } = useSession();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newType, setNewType] = useState({ name: "" });

  const fetchTypes = async () => {
    setLoading(true);
    const res = await fetch("/api/task-types");
    const data = await res.json();
    setTypes(data);
    setLoading(false);
  };

  useEffect(() => {
    if (session?.user && (session.user as any).role === "ADMIN") {
      fetchTypes();
    }
  }, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/task-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newType),
    });
    if (res.ok) {
      setShowModal(false);
      setNewType({ name: "" });
      fetchTypes();
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка при создании");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот тип?")) return;
    const res = await fetch(`/api/task-types/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchTypes();
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка при удалении");
    }
  };

  if (!session || (session.user as any).role !== "ADMIN") return <div>Нет доступа</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Типы задач</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Создать тип</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
               <th>ID</th>
               <th>Название</th>
               <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ textAlign: 'center' }}>Загрузка...</td></tr>
            ) : (
              types.map(type => (
                <tr key={type.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '120px' }}>
                    #{type.id}
                  </td>
                  <td>{type.name}</td>
                  <td>
                    <button className="nav-link" onClick={() => handleDelete(type.id)} style={{ color: 'var(--error)', background: 'none' }}>Удалить</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <div className="modal-body">
              <h2>Новый тип задачи</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <input placeholder="Название" required value={newType.name} onChange={e => setNewType({ name: e.target.value })} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>Создать</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
