"use client";

import { useState, useEffect } from "react";
import Select from "react-select";
import dynamic from "next/dynamic";
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
import "react-quill-new/dist/quill.snow.css";

export default function CreateTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [types, setTypes] = useState<any[]>([]);
  const [directions, setDirections] = useState<any[]>([]);
  const [executors, setExecutors] = useState<any[]>([]);
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  const [error, setError] = useState("");

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

    if (!title || !description || description === "<p><br></p>" || !typeId || !deadline || !selectedExecutors.length || !selectedDirections.length) {
      setError("Все поля обязательны для заполнения");
      return;
    }

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        typeId,
        deadline,
        assignees: selectedExecutors,
        directions: selectedDirections,
      }),
    });
    
    if (res.ok) {
        onCreated();
    } else {
        const data = await res.json();
        setError(data.error || "Ошибка при создании задачи");
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
      <h2 style={{ marginBottom: '8px' }}>Создать задачу</h2>
      
      {error && <div style={{ color: 'var(--rejected)', background: 'rgba(255,0,0,0.1)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}

      <div>
        <label>Название</label>
        <input placeholder="Название задачи" value={title} onChange={e => setTitle(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
            <label>Тип задачи</label>
            <select value={typeId} onChange={e => setTypeId(e.target.value)}>
                <option value="">Выберите тип...</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        </div>
        <div>
            <label>Дедлайн</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
      </div>

      <div className="quill-editor-container">
        <label>Описание</label>
        <ReactQuill 
          theme="snow" 
          value={description} 
          onChange={setDescription}
          modules={quillModules}
          placeholder="Введите описание задачи..."
        />
      </div>

      <div>
        <label>Ответственные</label>
        <Select
          isMulti
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
          options={directionOptions}
          value={directionOptions.filter((o: any) => selectedDirections.includes(o.value))}
          onChange={(selected: any) => setSelectedDirections(selected.map((s: any) => s.value))}
          placeholder="Выберите направления..."
          styles={customStyles}
        />
      </div>

      <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Создать задачу</button>
    </form>
  );
}
