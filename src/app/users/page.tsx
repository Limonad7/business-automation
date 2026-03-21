"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [newUser, setNewUser] = useState({
    email: "",
    fullName: "",
    role: "EXECUTOR",
    password: "",
  });

  const openEditModal = (user: any) => {
    setEditingUser({ ...user, password: "" });
  };

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    const res = await fetch(`/api/users?page=${page}&limit=${pagination.limit}`);
    const data = await res.json();
    setUsers(data.users);
    setPagination(data.pagination);
    setLoading(false);
  };

  useEffect(() => {
    if (session?.user && (session.user as any).role === "ADMIN") {
      fetchUsers(1);
    }
  }, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setShowModal(false);
      setNewUser({ email: "", fullName: "", role: "EXECUTOR", password: "" });
      fetchUsers(pagination.page);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "Ошибка при создании пользователя");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const dataToSend = { ...editingUser };
    if (!dataToSend.password) delete dataToSend.password;

    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });
    if (res.ok) {
      setEditingUser(null);
      fetchUsers(pagination.page);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "Ошибка при обновлении пользователя");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите полностью удалить пользователя? Это действие необратимо и возможно только если у пользователя нет никакой активности в системе.")) return;
    
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers(pagination.page);
    } else {
      const errorData = await res.json();
      alert(errorData.error || "Ошибка при удалении пользователя");
    }
  };

  if (!session || (session.user as any).role !== "ADMIN") return <div>Нет доступа</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Пользователи</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Создать пользователя</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>Загрузка...</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', minWidth: '100px', maxWidth: '120px' }}>
                    #{user.id}
                  </td>
                  <td style={{ fontWeight: 500 }}>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge badge-pending" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.isBlocked ? (
                      <span className="badge badge-rejected">Заблокирован</span>
                    ) : (
                      <span className="badge badge-published">Активен</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary" onClick={() => openEditModal(user)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Изм.</button>
                      {user.id !== (session.user as any).id && (
                        <button className="btn-secondary" onClick={() => handleDelete(user.id)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}>Удалить</button>
                      )}
                    </div>
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
          onClick={() => fetchUsers(pagination.page - 1)}
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
          onClick={() => fetchUsers(pagination.page + 1)}
          style={{ padding: '8px 16px' }}
        >
          Вперед
        </button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px' }}>
            <h2>Новый пользователь</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <input placeholder="Email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <input placeholder="ФИО" required value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
              <input placeholder="Пароль" type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="ADMIN">Администратор</option>
                <option value="EXECUTOR">Исполнитель</option>
                <option value="UCH">Сотрудник УЧ</option>
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Создать</button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px' }}>
            <h2>Редактировать пользователя</h2>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <input placeholder="Email" required value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
              <input placeholder="ФИО" required value={editingUser.fullName} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} />
              <input placeholder="Новый пароль (если нужно изменить)" type="password" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
              <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                <option value="ADMIN">Администратор</option>
                <option value="EXECUTOR">Исполнитель</option>
                <option value="UCH">Сотрудник УЧ</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={editingUser.isBlocked} onChange={e => setEditingUser({...editingUser, isBlocked: e.target.checked})} />
                Заблокирован
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Сохранить</button>
                <button type="button" className="btn-secondary" onClick={() => setEditingUser(null)} style={{ flex: 1 }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
