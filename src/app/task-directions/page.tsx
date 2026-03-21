"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function TaskDirectionsPage() {
  const { data: session } = useSession();
  const [directions, setDirections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDirection, setNewDirection] = useState({ name: "" });

  const fetchDirections = async () => {
    setLoading(true);
    const res = await fetch("/api/task-directions");
    const data = await res.json();
    setDirections(data);
    setLoading(false);
  };

  useEffect(() => {
    if (session?.user && (session.user as any).role === "ADMIN") {
      fetchDirections();
    }
  }, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/task-directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDirection),
    });
    if (res.ok) {
      setShowModal(false);
      setNewDirection({ name: "" });
      fetchDirections();
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка при создании");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить это направление?")) return;
    const res = await fetch(`/api/task-directions/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchDirections();
    } else {
      const data = await res.json();
      alert(data.error || "Ошибка при удалении");
    }
  };

  if (!session || (session.user as any).role !== "ADMIN") return <div>Нет доступа</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Направления задач</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Создать направление</button>
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
              directions.map(direction => (
                <tr key={direction.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '120px' }}>
                    #{direction.id}
                  </td>
                  <td>{direction.name}</td>
                  <td>
                    <button className="nav-link" onClick={() => handleDelete(direction.id)} style={{ color: 'var(--error)', background: 'none' }}>Удалить</button>
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
              <h2>Новое направление задачи</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <input placeholder="Название" required value={newDirection.name} onChange={e => setNewDirection({ name: e.target.value })} />
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
