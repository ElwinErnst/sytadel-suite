'use client';

import { useRef, useState, useTransition } from 'react';
import { publishPolicyAction } from './actions';
import {
  MAX_POLICY_RULES,
  ZT_ACTOR_TYPES,
  ZT_HTTP_METHODS,
  ZT_UPSTREAMS,
  type PolicyEffect,
  type PolicyRule,
  type PolicySet,
  type ZtActorType,
  type ZtHttpMethod,
  type ZtUpstream,
} from '@/lib/server/types/policy.type';

/**
 * UI-shaped draft of a rule. Optional policy fields are kept as always-present
 * form values (empty string / empty array) for a stable controlled form, and
 * sanitized back into the strict policy schema only at publish time.
 */
type RuleDraft = {
  _key: number;
  description: string;
  effect: PolicyEffect;
  upstream: ZtUpstream;
  methods: ZtHttpMethod[];
  pathGlob: string;
  roleInText: string;
  actorTypeIn: ZtActorType[];
  reason: string;
};

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return keyCounter;
}

function toDraft(rule: PolicyRule): RuleDraft {
  return {
    _key: nextKey(),
    description: rule.description,
    effect: rule.effect,
    upstream: rule.when.upstream,
    methods: rule.when.methods ?? [],
    pathGlob: rule.when.pathGlob ?? '',
    roleInText: (rule.if?.roleIn ?? []).join(', '),
    actorTypeIn: rule.if?.actorTypeIn ?? [],
    reason: rule.reason ?? '',
  };
}

function emptyDraft(): RuleDraft {
  return {
    _key: nextKey(),
    description: '',
    effect: 'allow',
    upstream: 'vault',
    methods: [],
    pathGlob: '',
    roleInText: '',
    actorTypeIn: [],
    reason: '',
  };
}

/** Draft -> strict policy rule: omit empty optional fields entirely. */
function fromDraft(draft: RuleDraft): PolicyRule {
  const when: PolicyRule['when'] = { upstream: draft.upstream };
  if (draft.methods.length > 0) when.methods = draft.methods;
  const pathGlob = draft.pathGlob.trim();
  if (pathGlob) when.pathGlob = pathGlob;

  const roleIn = draft.roleInText
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);

  let condition: PolicyRule['if'] | undefined;
  if (roleIn.length > 0 || draft.actorTypeIn.length > 0) {
    condition = {};
    if (roleIn.length > 0) condition.roleIn = roleIn;
    if (draft.actorTypeIn.length > 0) condition.actorTypeIn = draft.actorTypeIn;
  }

  const rule: PolicyRule = {
    description: draft.description.trim(),
    effect: draft.effect,
    when,
  };
  if (condition) rule.if = condition;
  const reason = draft.reason.trim();
  if (reason) rule.reason = reason;

  return rule;
}

type Props = {
  initialPolicy: PolicySet;
  canEdit: boolean;
};

export function PolicyEditor({ initialPolicy, canEdit }: Props) {
  const [defaultEffect, setDefaultEffect] = useState<PolicyEffect>(
    initialPolicy.default,
  );
  const [drafts, setDrafts] = useState<RuleDraft[]>(() =>
    initialPolicy.rules.map(toDraft),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Snapshot of what is currently published, to detect unsaved changes. Built
  // through the same draft pipeline as buildPolicySet so key ordering matches
  // and an unedited policy never reads as "unsaved".
  const publishedSnapshot = useRef(
    JSON.stringify({
      version: 1,
      rules: initialPolicy.rules.map(toDraft).map(fromDraft),
      default: initialPolicy.default,
    } satisfies PolicySet),
  );

  function patchDraft(key: number, patch: Partial<RuleDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d._key === key ? { ...d, ...patch } : d)),
    );
  }

  function toggleMethod(key: number, method: ZtHttpMethod) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d._key !== key) return d;
        const has = d.methods.includes(method);
        return {
          ...d,
          methods: has
            ? d.methods.filter((m) => m !== method)
            : [...d.methods, method],
        };
      }),
    );
  }

  function toggleActorType(key: number, actorType: ZtActorType) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d._key !== key) return d;
        const has = d.actorTypeIn.includes(actorType);
        return {
          ...d,
          actorTypeIn: has
            ? d.actorTypeIn.filter((a) => a !== actorType)
            : [...d.actorTypeIn, actorType],
        };
      }),
    );
  }

  function addRule() {
    setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeRule(key: number) {
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  }

  function buildPolicySet(): PolicySet {
    return {
      version: 1,
      rules: drafts.map(fromDraft),
      default: defaultEffect,
    };
  }

  function onPublish() {
    setError(null);
    setMessage(null);

    const missingDescription = drafts.some((d) => !d.description.trim());
    if (missingDescription) {
      setError('Cada regla necesita una descripción.');
      return;
    }

    const policySet = buildPolicySet();

    startTransition(async () => {
      const result = await publishPolicyAction(policySet);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      publishedSnapshot.current = JSON.stringify(policySet);
      setMessage(`Política publicada como versión ${result.version}.`);
    });
  }

  const hasUnsavedChanges =
    publishedSnapshot.current !== JSON.stringify(buildPolicySet());

  const chipStyle = (active: boolean): React.CSSProperties => ({
    cursor: canEdit ? 'pointer' : 'default',
    opacity: active ? 1 : 0.5,
    borderColor: active ? 'rgba(135, 84, 255, 0.55)' : undefined,
  });

  return (
    <div className="stack">
      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="zt-default">Acción por defecto</label>
        <select
          id="zt-default"
          className="select"
          value={defaultEffect}
          disabled={!canEdit}
          onChange={(e) => setDefaultEffect(e.target.value as PolicyEffect)}
        >
          <option value="deny">Denegar (recomendado)</option>
          <option value="allow">Permitir</option>
        </select>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {drafts.length === 0 ? (
          <p className="muted">
            Todavía no hay reglas. Con la acción por defecto en “Denegar”, el
            tenant queda cerrado hasta que agregues reglas de permiso.
          </p>
        ) : (
          drafts.map((draft, index) => (
            <div
              key={draft._key}
              className="stack-sm"
              style={{
                padding: '14px 16px',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong>Regla {index + 1}</strong>
                {canEdit ? (
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => removeRule(draft._key)}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>

              <div className="field">
                <label>Descripción</label>
                <input
                  className="input"
                  value={draft.description}
                  disabled={!canEdit}
                  placeholder='ej. "Lectura de documentos para miembros"'
                  onChange={(e) =>
                    patchDraft(draft._key, { description: e.target.value })
                  }
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                }}
              >
                <div className="field">
                  <label>Efecto</label>
                  <select
                    className="select"
                    value={draft.effect}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patchDraft(draft._key, {
                        effect: e.target.value as PolicyEffect,
                      })
                    }
                  >
                    <option value="allow">Permitir</option>
                    <option value="deny">Denegar</option>
                  </select>
                </div>

                <div className="field">
                  <label>Servicio (upstream)</label>
                  <select
                    className="select"
                    value={draft.upstream}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patchDraft(draft._key, {
                        upstream: e.target.value as ZtUpstream,
                      })
                    }
                  >
                    {ZT_UPSTREAMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Ruta (glob, opcional)</label>
                  <input
                    className="input"
                    value={draft.pathGlob}
                    disabled={!canEdit}
                    placeholder="ej. /documents/**"
                    onChange={(e) =>
                      patchDraft(draft._key, { pathGlob: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Métodos HTTP (vacío = todos)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ZT_HTTP_METHODS.map((method) => {
                    const active = draft.methods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        className="badge"
                        disabled={!canEdit}
                        style={chipStyle(active)}
                        onClick={() => toggleMethod(draft._key, method)}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                }}
              >
                <div className="field">
                  <label>Roles (opcional, separados por coma)</label>
                  <input
                    className="input"
                    value={draft.roleInText}
                    disabled={!canEdit}
                    placeholder="ej. OWNER, ADMIN"
                    onChange={(e) =>
                      patchDraft(draft._key, { roleInText: e.target.value })
                    }
                  />
                </div>

                <div className="field">
                  <label>Tipo de actor (opcional)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ZT_ACTOR_TYPES.map((actorType) => {
                      const active = draft.actorTypeIn.includes(actorType);
                      return (
                        <button
                          key={actorType}
                          type="button"
                          className="badge"
                          disabled={!canEdit}
                          style={chipStyle(active)}
                          onClick={() =>
                            toggleActorType(draft._key, actorType)
                          }
                        >
                          {actorType}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Motivo (opcional)</label>
                <input
                  className="input"
                  value={draft.reason}
                  disabled={!canEdit}
                  placeholder="Se registra en la decisión para auditoría"
                  onChange={(e) =>
                    patchDraft(draft._key, { reason: e.target.value })
                  }
                />
              </div>
            </div>
          ))
        )}
      </div>

      {canEdit ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            className="button-secondary"
            onClick={addRule}
            disabled={drafts.length >= MAX_POLICY_RULES}
          >
            {drafts.length >= MAX_POLICY_RULES
              ? `Máximo ${MAX_POLICY_RULES} reglas`
              : 'Agregar regla'}
          </button>
          <button
            type="button"
            className="button"
            onClick={onPublish}
            disabled={isPending || !hasUnsavedChanges}
          >
            {isPending
              ? 'Publicando…'
              : hasUnsavedChanges
                ? 'Publicar política'
                : 'Sin cambios para publicar'}
          </button>
        </div>
      ) : (
        <p className="muted">
          Solo una cuenta OWNER o ADMIN puede editar y publicar la política.
        </p>
      )}
    </div>
  );
}
