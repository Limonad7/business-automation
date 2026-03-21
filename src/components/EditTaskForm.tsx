"use client";

import { useState, useEffect } from "react";
import Select from "react-select";
import dynamic from "next/dynamic";
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
import "react-quill-new/dist/quill.snow.css";
import { useSession } from "next-auth/react";

export default function EditTaskForm({ task, onUpdated }: { task: any, onUpdated: () => void }) {
  const { data: session } = useSession();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [typeId, setTypeId] = useState(task.typeId);
  const [deadline, setDeadline] = useState(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : "");
  const [status, setStatus] = useState(task.status);
  const [types, setTypes] = useState<any[]>([]);
  const [directions, setDirections] = useState<any[]>([]);
  const [executors, setExecutors] = useState<any[]>([]);
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>(
    task.assignees?.map((a: any) => a.userId) || []
  );
  const [selectedDirections, setSelectedDirections] = useState<string[]>(
    task.directions?.map((d: any) => d.directionId) || []
  );
  const [error, setError] = useState("");

  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isExecutor = (session?.user as any)?.role === "EXECUTOR";
  const isCreator = (session?.user as any)?.id === task.creatorId;
  const canModifyMeta = isAdmin || isCreator || (session?.user as any)?.role === "UCH";

  const STATUS_OPTIONS = [
    { value: "PENDING", label: "В ожидании" },
    { value: "CLARIFICATION", label: "На уточнении" },
    { value: "REJECTED", label: "Отклонена" },
    { value: "IN_PROGRESS", label: "В работе" },
    { value: "IN_REVIEW", label: "На проверке" },
    { value: "IN_PUBLICATION", label: "На публикации" },
    { value: "PUBLISHED_NO_HW", label: "Опубликово без ДЗ" },
    { value: "PUBLISHED_NO_HW_PRO", label: "Опубликовано без ДЗ Pro" },
    { value: "REWORKING", label: "На доработке" },
    { value: "COMPLETED", label: "Завершена" },
  ];

  const filteredStatusOptions = STATUS_OPTIONS.filter(opt => {
    if (isExecutor && !isAdmin && (opt.value === "REJECTED" || opt.value === "COMPLETED")) return false;
    return true;
  });

  useEffect(() => {
    fetch("/api/task-types").then(res => res.json()).then(setTypes);
    fetch("/api/task-directions").then(res => res.json()).then(setDirections);
    fetch("/api/users?limit=1000").then(res => res.json()).then(data => 
      setExecutors((data.users || []).filter((u: any) => u.role === "EXECUTOR"))
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title || !description || description === "<p><br></p>") {
        setError("Название и описание обязательны");
        return;
    }

    const payload: any = {
      title,
      description,
      status,
      deadline,
      typeId,
      assignees: selectedExecutors,
      directions: selectedDirections,
    };

    if (isExecutor && !isAdmin && !isCreator) {
        delete payload.title;
        delete payload.deadline;
        delete payload.typeId;
        delete payload.assignees;
        delete payload.directions;
    }

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
        onUpdated();
    } else {
        const err = await res.json();
        setError(err.error || "Не удалось обновить задачу");
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'clean']
    ],
  };

  const customStyles = {
    control: (base: any) => ({
      ...base,
      background: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'var(--glass-border)',
      color: 'white',
    }),
    singleValue: (base: any) => ({ ...base, color: 'white' }),
    multiValue: (base: any) => ({ ...base, background: 'rgba(255,255,255,0.1)' }),
    multiValueLabel: (base: any) => ({ ...base, color: 'white' }),
    menu: (base: any) => ({ ...base, background: 'var(--card-bg)' }),
    option: (base: any, state: any) => ({
      ...base,
      background: state.isFocused ? 'rgba(255,255,255,0.1)' : 'transparent',
      color: 'white',
      cursor: 'pointer'
    })
  };

  const executorOptions = executors.map((u: any) => ({ value: u.id, label: u.fullName }));
  const directionOptions = directions.map((d: any) => ({ value: d.id, label: d.name }));

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>Редактировать задачу</h2>

      {error && <div style={{ color: 'var(--rejected)', background: 'rgba(255,0,0,0.1)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}

      <div>
        <label>Название</label>
        <input required value={title} onChange={e => setTitle(e.target.value)} disabled={!canModifyMeta} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
            <label>Тип задачи</label>
            <select required value={typeId} onChange={e => setTypeId(e.target.value)} disabled={!canModifyMeta}>
                <option value="">Выберите тип...</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        </div>
        <div>
            <label>Статус</label>
            <select required value={status} onChange={e => setStatus(e.target.value)}>
                {filteredStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
      </div>

      <div className="quill-editor-container">
        <label>Описание</label>
        <ReactQuill 
          theme="snow" 
          value={description} 
          onChange={setDescription}
          modules={quillModules}
        />
      </div>

      <div>
        <label>Дедлайн</label>
        <input type="date" required value={deadline} onChange={e => setDeadline(e.target.value)} disabled={!canModifyMeta} />
      </div>

      <div>
        <label>Ответственные</label>
        <Select
          isMulti
          isDisabled={!canModifyMeta}
          options={executorOptions}
          value={executorOptions.filter((o: any) => selectedExecutors.includes(o.value))}
          onChange={(selected: any) => setSelectedExecutors(selected.map((s: any) => s.value))}
          placeholder="Выберите ответственных..."
          styles={customStyles}
        />
      </div>

      <div>
        <label>Направления</label>
        <Select
          isMulti
          isDisabled={!canModifyMeta}
          options={directionOptions}
          value={directionOptions.filter((o: any) => selectedDirections.includes(o.value))}
          onChange={(selected: any) => setSelectedDirections(selected.map((s: any) => s.value))}
          placeholder="Выберите направления..."
          styles={customStyles}
        />
      </div>

      <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Сохранить изменения</button>
    </form>
  );
}
