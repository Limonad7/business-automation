"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import EditTaskForm from "@/components/EditTaskForm";

const STATUS_LABELS: any = {
  PENDING: "В ожидании",
  CLARIFICATION: "На уточнении",
  REJECTED: "Отклонена",
  IN_PROGRESS: "В работе",
  IN_REVIEW: "На проверке",
  IN_PUBLICATION: "На публикации",
  PUBLISHED_NO_HW: "Опубликово без ДЗ",
  PUBLISHED_NO_HW_PRO: "Опубликовано без ДЗ Pro",
  REWORKING: "На доработке",
  COMPLETED: "Завершена",
};

export default function TaskDetailsPage() {
  const params = useParams();
  const id = params?.id;
  const { data: session } = useSession();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchTask = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setTask(data);
    } catch (err: any) {
      console.error("Failed to fetch task", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [id]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setTask({ ...task, comments: [...(task.comments || []), newComment] });
        setCommentText("");
      }
    } catch (error) {
      console.error("Failed to post comment", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm("Вы уверены, что хотите удалить эту задачу?")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/tasks";
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при удалении");
      }
    } catch (error) {
      alert("Произошла ошибка при удалении");
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!confirm("Удалить этот комментарий?")) return;
    try {
      const res = await fetch(`/api/tasks/${id}/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) {
        setTask({ ...task, comments: task.comments.filter((c: any) => c.id !== commentId) });
      }
    } catch (error) {
      alert("Ошибка при удалении комментария");
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--rejected)' }}>Ошибка при загрузке задачи: {error}</div>;
  if (!task) return <div style={{ padding: '40px', textAlign: 'center' }}>Задача не найдена</div>;

  const isAdmin = (session?.user as any).role === "ADMIN";
  const isCreatorOrAdmin = isAdmin || (session?.user as any).id === task.creatorId;

  const UNIT_LABELS: Record<string, string> = {
    HOURS: "ч.",
    UNITS: "шт.",
    DAYS: "дн.",
    FIX: "фикс"
  };

  // Calculate spent from reports if not already provided by API (though we should update API to include it)
  // Our GET /api/tasks/[id] doesn't calculate spent yet. Let's fix that or calculate here.
  // Actually, I'll calculate it from reports if Task includes them, but current API only gives comments.
  // I'll update the API to include spent volume.

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className={`badge badge-${task.status?.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[task.status] || task.status}</span>
            <span style={{ color: 'var(--text-muted)' }}>{task.type?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isCreatorOrAdmin && (
            <button className="btn-secondary" onClick={handleDeleteTask} style={{ borderColor: 'var(--rejected)', color: 'var(--rejected)' }}>Удалить</button>
          )}
          <button className="btn-primary" onClick={() => setShowEditModal(true)}>Редактировать</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px', marginBottom: '32px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Дедлайн</label>
          <div style={{ fontWeight: 600 }}>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}</div>
        </div>
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Направления</label>
          <div style={{ fontWeight: 600 }}>{task.directions?.length ? task.directions.map((d: any) => d.direction.name).join(", ") : "—"}</div>
        </div>
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Создатель</label>
          <div style={{ fontWeight: 600 }}>{task.creator?.fullName || '—'}</div>
        </div>
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ответственные</label>
          <div style={{ fontWeight: 600 }}>{task.assignees?.map((a: any) => a.user.fullName).join(", ") || "Нет"}</div>
        </div>
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Затрачено</label>
          <div style={{ fontWeight: 600 }}>
            {task.spent?.length > 0 ? (
                task.spent.map((s: any, idx: number) => (
                    <div key={idx}>{s.volume} {UNIT_LABELS[s.unit] || s.unit}</div>
                ))
            ) : "0"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Описание</h3>
        <div 
          className="description-content quill-content"
          style={{ background: 'var(--glass)', padding: '20px', borderRadius: '12px', minHeight: '100px' }}
          dangerouslySetInnerHTML={{ __html: task.description }}
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '16px' }}>Комментарии</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {task.comments?.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Пока нет комментариев</p>
          ) : (
            task.comments?.map((c: any) => (
              <div key={c.id} className="card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{c.user.fullName}</span>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                    {isAdmin && (
                        <button 
                            onClick={() => handleCommentDelete(c.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--rejected)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                        >
                            Удалить
                        </button>
                    )}
                  </div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
              </div>
            ))
          )}
        </div>
        
        <form onSubmit={handleCommentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <textarea 
            placeholder="Оставьте комментарий..." 
            style={{ minHeight: '80px' }}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={submitting}
          />
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ alignSelf: 'flex-end' }}
            disabled={submitting || !commentText.trim()}
          >
            {submitting ? "Отправка..." : "Отправить"}
          </button>
        </form>
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            <div className="modal-body">
              <EditTaskForm 
                task={task} 
                onUpdated={() => {
                  setShowEditModal(false);
                  fetchTask();
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
