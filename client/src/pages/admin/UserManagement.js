// client/src/pages/admin/UserManagement.js
//
// The admin's directory of every account on the platform. It was written but
// never routed, so nothing here had ever run; the notes below mark what was
// wrong when it was first switched on.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageShell,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr
} from '../../components/ui';
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  BuildingOfficeIcon,
  UsersIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Student' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'tpo', label: 'TPO' },
  { value: 'admin', label: 'Admin' },
  { value: 'principal', label: 'Principal' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'school_admin', label: 'School admin' },
  { value: 'career_counselor', label: 'Career counsellor' }
];

const ACTIVE_OPTIONS = [
  { value: '', label: 'Active and inactive' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Inactive only' }
];

const ROLE_TONES = {
  admin: 'danger',
  tpo: 'info',
  recruiter: 'purple',
  student: 'success'
};

const EMPTY_FILTERS = {
  search: '',
  role: '',
  organizationId: '',
  isActive: '',
  year: '',
  stream: '',
  state: '',
  city: ''
};

const PAGE_SIZE = 20;

const UserManagement = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [organizations, setOrganizations] = useState([]);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '') params.set(key, value);
      });
      // `silent`: this page renders its own error panel, and the shared
      // interceptor toasting the same failure would say it twice.
      const data = await api.get(`/users?${params.toString()}`, { silent: true });
      setUsers(data.users || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1, totalUsers: 0 });
    } catch (err) {
      setError(err?.message || 'Could not load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    // Debounced so typing in the search box does not fire a request per key.
    const t = setTimeout(fetchUsers, 350);
    return () => clearTimeout(t);
  }, [isAdmin, fetchUsers]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get('/organizations?limit=500', { silent: true })
      .then((data) => setOrganizations(data.organizations || []))
      // The organization filter is a convenience; losing it must not take the
      // rest of the page down with it.
      .catch(() => setOrganizations([]));
  }, [isAdmin]);

  const setFilter = (name) => (e) => {
    const { value } = e.target;
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== '').length,
    [filters]
  );

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const data = await api.get(`/admin/users/${id}`, { silent: true });
      setDetail(data.user);
    } catch (err) {
      setDetail(null);
      toast.error(err?.message || 'Could not load that user.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = (row) => {
    setEditError(null);
    setEditing(row);
    setEditData({
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      email: row.email || '',
      phone: row.phone || '',
      role: row.role,
      approvalStatus: row.approvalStatus || 'pending',
      isActive: Boolean(row.isActive)
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      await api.put(`/admin/users/${editing.id}`, editData, { silent: true });
      toast.success('User updated');
      setEditing(null);
      fetchUsers();
    } catch (err) {
      setEditError(err?.message || 'Could not save those changes.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    setDeactivating(true);
    try {
      await api.delete(`/admin/users/${pendingDeactivate.id}`, { silent: true });
      toast.success('User deactivated');
      setPendingDeactivate(null);
      fetchUsers();
    } catch (err) {
      toast.error(err?.message || 'Could not deactivate that user.');
    } finally {
      setDeactivating(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageShell>
        <EmptyState
          icon={LockClosedIcon}
          title="Admins only"
          description="This page manages every account on the platform, so it is restricted to administrators."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Administration"
        title="User management"
        lead="Every account on the platform, with the filters the API supports."
        actions={
          <Badge tone="neutral">
            <UsersIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {pagination.totalUsers ?? 0} matching
          </Badge>
        }
      />

      <Toolbar className="flex-wrap">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Search"
            icon={MagnifyingGlassIcon}
            value={filters.search}
            onChange={setFilter('search')}
            placeholder="Name or email"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select label="Role" value={filters.role} onChange={setFilter('role')} options={ROLE_OPTIONS} />
        </div>
        <div className="w-full sm:w-56">
          <Select
            label="Organization"
            value={filters.organizationId}
            onChange={setFilter('organizationId')}
            options={[
              { value: '', label: 'All organizations' },
              ...organizations.map((o) => ({ value: String(o.id), label: o.name }))
            ]}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Account state"
            value={filters.isActive}
            onChange={setFilter('isActive')}
            options={ACTIVE_OPTIONS}
          />
        </div>
      </Toolbar>

      <Toolbar className="-mt-2 flex-wrap">
        <div className="w-full sm:w-32">
          <Select
            label="Year"
            value={filters.year}
            onChange={setFilter('year')}
            options={[
              { value: '', label: 'Any' },
              ...[1, 2, 3, 4, 5, 6].map((y) => ({ value: String(y), label: `Year ${y}` }))
            ]}
          />
        </div>
        <div className="w-full sm:w-48">
          <Input label="Stream" value={filters.stream} onChange={setFilter('stream')} placeholder="e.g. CSE" />
        </div>
        <div className="w-full sm:w-44">
          <Input label="State" value={filters.state} onChange={setFilter('state')} placeholder="e.g. Punjab" />
        </div>
        <div className="w-full sm:w-44">
          <Input label="City" value={filters.city} onChange={setFilter('city')} placeholder="e.g. Mohali" />
        </div>
        <div className="sm:self-end sm:pb-0.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeFilterCount === 0}
            onClick={() => {
              setPage(1);
              setFilters(EMPTY_FILTERS);
            }}
          >
            Clear {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
        </div>
      </Toolbar>

      {loading && (
        <Card>
          <Skeleton className="h-8 w-full" />
          <div className="mt-3 space-y-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </Card>
      )}

      {!loading && error && (
        <ErrorState title="Could not load users" description={error} onRetry={fetchUsers} />
      )}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          icon={UsersIcon}
          title="No users match"
          description="Nothing on the platform fits these filters. Widen them and try again."
          action={
            <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <Table>
            <Thead>
              <Tr className="hover:bg-transparent">
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Organization</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={row.profilePicture}
                        name={`${row.firstName} ${row.lastName}`}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-950">
                          {row.firstName} {row.lastName}
                        </p>
                        <p className="truncate text-xs text-ink-500">{row.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONES[row.role] || 'neutral'}>{row.role.replace(/_/g, ' ')}</Badge>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1.5 text-sm">
                      <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
                      {row.organization?.name || '—'}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.approvalStatus} />
                      {!row.isActive && <Badge tone="danger">Inactive</Badge>}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-sm text-ink-600">
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <IconButton
                        size="sm"
                        icon={EyeIcon}
                        label={`View ${row.firstName} ${row.lastName}`}
                        onClick={() => openDetail(row.id)}
                      />
                      <IconButton
                        size="sm"
                        icon={PencilSquareIcon}
                        label={`Edit ${row.firstName} ${row.lastName}`}
                        onClick={() => openEdit(row)}
                      />
                      {/* The original guarded this with `user.id !== user.id`,
                          a self-comparison that is always false, so the control
                          could never render. The real rule is that an admin
                          must not deactivate their own account. */}
                      {row.id !== currentUser?.id && (
                        <IconButton
                          size="sm"
                          variant="danger"
                          icon={TrashIcon}
                          label={`Deactivate ${row.firstName} ${row.lastName}`}
                          onClick={() => setPendingDeactivate(row)}
                        />
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Pagination
            className="mt-6"
            page={pagination.currentPage}
            pages={pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}

      {/* ------------------------------------------------------------ detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="User details"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail?.role && (
              <Button
                onClick={() => {
                  const target = detail;
                  setDetail(null);
                  openEdit(target);
                }}
              >
                Edit user
              </Button>
            )}
          </>
        }
      >
        {detailLoading || !detail?.role ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar src={detail.profilePicture} name={`${detail.firstName} ${detail.lastName}`} size="lg" />
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-ink-950">
                  {detail.firstName} {detail.lastName}
                </h3>
                <p className="truncate text-sm text-ink-600">{detail.email}</p>
                <Badge tone={ROLE_TONES[detail.role] || 'neutral'} className="mt-1.5">
                  {detail.role.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-ink-950/10 border-t border-ink-950/10">
              <DetailRow label="Phone">{detail.phone || '—'}</DetailRow>
              <DetailRow label="Organization">{detail.organization?.name || '—'}</DetailRow>
              <DetailRow label="Approval">
                <StatusBadge status={detail.approvalStatus} />
              </DetailRow>
              <DetailRow label="Account">
                <Badge tone={detail.isActive ? 'success' : 'neutral'}>
                  {detail.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </DetailRow>
              <DetailRow label="Joined">
                {detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '—'}
              </DetailRow>
              <DetailRow label="Last login">
                {detail.lastLogin ? new Date(detail.lastLogin).toLocaleString() : 'Never'}
              </DetailRow>
            </dl>
          </>
        )}
      </Modal>

      {/* -------------------------------------------------------------- edit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Edit user'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user" loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-user" onSubmit={submitEdit} className="space-y-4">
          {editError && <ErrorState title="Could not save" description={editError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              required
              value={editData.firstName || ''}
              onChange={(e) => setEditData((d) => ({ ...d, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              required
              value={editData.lastName || ''}
              onChange={(e) => setEditData((d) => ({ ...d, lastName: e.target.value }))}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={editData.email || ''}
            onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))}
          />
          <Input
            label="Phone"
            type="tel"
            value={editData.phone || ''}
            onChange={(e) => setEditData((d) => ({ ...d, phone: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Role"
              value={editData.role || 'student'}
              onChange={(e) => setEditData((d) => ({ ...d, role: e.target.value }))}
              options={ROLE_OPTIONS.filter((o) => o.value !== '')}
            />
            <Select
              label="Approval status"
              value={editData.approvalStatus || 'pending'}
              onChange={(e) => setEditData((d) => ({ ...d, approvalStatus: e.target.value }))}
              options={[
                { value: 'approved', label: 'Approved' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' }
              ]}
            />
          </div>
          <Select
            label="Account state"
            value={editData.isActive ? 'true' : 'false'}
            onChange={(e) => setEditData((d) => ({ ...d, isActive: e.target.value === 'true' }))}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' }
            ]}
          />
        </form>
      </Modal>

      {/* -------------------------------------------------- deactivate guard */}
      <Modal
        open={Boolean(pendingDeactivate)}
        onClose={() => setPendingDeactivate(null)}
        title="Deactivate this user?"
        description="They will be signed out and unable to log in until an admin reactivates them."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDeactivate(null)}>
              Keep active
            </Button>
            <Button variant="danger" loading={deactivating} onClick={confirmDeactivate}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {pendingDeactivate
            ? `${pendingDeactivate.firstName} ${pendingDeactivate.lastName} (${pendingDeactivate.email})`
            : ''}
        </p>
      </Modal>
    </PageShell>
  );
};

export default UserManagement;
