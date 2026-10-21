'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getMerchantCategories,
  createMerchantCategory,
  updateMerchantCategory,
  deleteMerchantCategory,
  MerchantCategory,
} from '@/lib/medusa';
import ConfirmDeleteModal from '@/components/products/ConfirmDeleteModal';

const MAX_NAME_LENGTH = 100;

// The backend says "handle" because categories are matched by their URL name.
// For a merchant that is simply the same name twice.
function friendlyError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : '';
  if (message.toLowerCase().includes('already have a category')) {
    return 'You already have a category with this name.';
  }
  return message || fallback;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '44px',
  boxSizing: 'border-box',
  padding: '0 17px',
  border: '1px solid #E6E8EC',
  borderRadius: '22px',
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: '16px',
  color: '#111827',
  outline: 'none',
};

const pillButton: React.CSSProperties = {
  height: '44px',
  boxSizing: 'border-box',
  padding: '0 20px',
  borderRadius: '22px',
  fontFamily: 'inherit',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [toDelete, setToDelete] = useState<MerchantCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getMerchantCategories();
      setCategories(res.categories || []);
    } catch (err) {
      setLoadError(friendlyError(err, 'Could not load your categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Enter a category name.');
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      setError(`Category names can be at most ${MAX_NAME_LENGTH} characters.`);
      return;
    }

    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      await createMerchantCategory({ name });
      setNewName('');
      setNotice(`Category "${name}" created.`);
      await load();
    } catch (err) {
      setError(friendlyError(err, 'Could not create the category.'));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (category: MerchantCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
    setNotice(null);
  };

  const handleSaveEdit = async (category: MerchantCategory) => {
    const name = editName.trim();
    if (!name || name.length > MAX_NAME_LENGTH) {
      setError(`Category names must be 1 to ${MAX_NAME_LENGTH} characters.`);
      return;
    }
    if (name === category.name) {
      setEditingId(null);
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      await updateMerchantCategory(category.id, { name });
      setEditingId(null);
      setNotice('Category renamed.');
      await load();
    } catch (err) {
      setError(friendlyError(err, 'Could not rename the category.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMerchantCategory(toDelete.id);
      setNotice(`Category "${toDelete.name}" deleted.`);
      setToDelete(null);
      await load();
    } catch (err) {
      setError(friendlyError(err, 'Could not delete the category.'));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '28px 16px 20px 24px',
          minHeight: '44px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>Categories</h1>
      </div>

      <section
        style={{
          margin: '0 16px 17px 24px',
          background: '#FFFFFF',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ padding: '24px 24px 8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Your categories</h2>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
            Only you can see and change these. Deleting a category never deletes products.
          </p>
        </div>

        <form
          onSubmit={handleAdd}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '16px 24px 8px' }}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            aria-label="New category name"
            maxLength={MAX_NAME_LENGTH}
            style={{ ...inputStyle, maxWidth: '360px' }}
          />
          <button
            type="submit"
            disabled={adding}
            style={{
              ...pillButton,
              border: 0,
              background: adding ? '#9CA3AF' : 'var(--accent)',
              color: '#FFFFFF',
              cursor: adding ? 'not-allowed' : 'pointer',
            }}
          >
            {adding ? 'Adding...' : 'Add category'}
          </button>
        </form>

        {(error || notice) && (
          <div
            role={error ? 'alert' : 'status'}
            style={{
              margin: '8px 24px 0',
              padding: '10px 16px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 500,
              border: `1px solid ${error ? '#F5B5B5' : '#9BDDB4'}`,
              background: error ? '#FEF2F2' : '#F2FBF6',
              color: error ? '#B42318' : '#17803F',
            }}
          >
            {error || notice}
          </div>
        )}

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <div style={{ minWidth: '560px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.5fr) 140px 200px',
                alignItems: 'center',
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Name</span>
              <span>Products</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading categories...</div>
            ) : loadError ? (
              <div role="alert" style={{ padding: '48px', textAlign: 'center', color: '#B42318' }}>
                {loadError}
              </div>
            ) : categories.length === 0 ? (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '96px',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#4B5263',
                }}
              >
                No categories yet. Add your first one above.
              </div>
            ) : (
              categories.map((category) => {
                const isEditing = editingId === category.id;
                return (
                  <div
                    key={category.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.5fr) 140px 200px',
                      alignItems: 'center',
                      minHeight: '64px',
                      boxSizing: 'border-box',
                      padding: '8px 24px',
                      borderBottom: '1px solid #EDEFF3',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: '#111827',
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(category);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        aria-label={`Rename ${category.name}`}
                        maxLength={MAX_NAME_LENGTH}
                        autoFocus
                        style={{ ...inputStyle, maxWidth: '320px' }}
                      />
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                        {category.name}
                      </span>
                    )}

                    <span>{category.product_count ?? 0}</span>

                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveEdit(category)}
                            style={{
                              ...pillButton,
                              height: '36px',
                              padding: '0 16px',
                              fontSize: '14px',
                              border: 0,
                              background: 'var(--accent)',
                              color: '#FFFFFF',
                            }}
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => setEditingId(null)}
                            style={{
                              ...pillButton,
                              height: '36px',
                              padding: '0 16px',
                              fontSize: '14px',
                              fontWeight: 500,
                              border: '1px solid #D1D5DB',
                              background: '#FFFFFF',
                              color: '#374151',
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(category)}
                            aria-label={`Rename ${category.name}`}
                            style={{
                              ...pillButton,
                              height: '36px',
                              padding: '0 16px',
                              fontSize: '14px',
                              fontWeight: 500,
                              border: '1px solid #D1D5DB',
                              background: '#FFFFFF',
                              color: '#374151',
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(category)}
                            aria-label={`Delete ${category.name}`}
                            style={{
                              ...pillButton,
                              height: '36px',
                              padding: '0 16px',
                              fontSize: '14px',
                              fontWeight: 500,
                              border: '1px solid #F5B5B5',
                              background: '#FFFFFF',
                              color: '#B42318',
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div style={{ height: '16px' }} />
      </section>

      <ConfirmDeleteModal
        isOpen={toDelete !== null}
        title="Delete Category"
        itemName={toDelete?.name}
        loading={deleting}
        confirmLabel="Delete Category"
        message={
          toDelete ? (
            <>
              Delete <strong>&ldquo;{toDelete.name}&rdquo;</strong>?{' '}
              {toDelete.product_count
                ? `${toDelete.product_count} product${toDelete.product_count === 1 ? '' : 's'} will stay in your catalog without this category.`
                : 'No products use it.'}
            </>
          ) : undefined
        }
        onConfirm={handleConfirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
