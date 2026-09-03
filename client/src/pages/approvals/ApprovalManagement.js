// client/src/pages/approvals/ApprovalManagement.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import approvalService from '../../services/approvals';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const ApprovalManagement = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState({
    organizations: [],
    recruiters: [],
    total: 0
  });
  const [approvalStats, setApprovalStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('organizations');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [approvalsRes, statsRes] = await Promise.all([
        approvalService.getPendingApprovals(),
        approvalService.getApprovalStats()
      ]);
      
      setPendingApprovals(approvalsRes.data);
      setApprovalStats(statsRes.stats);
    } catch (error) {
      console.error('Failed to fetch approval data:', error);
      toast.error('Failed to load approval data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (itemId, type, action, itemNotes = '') => {
    try {
      if (type === 'organization') {
        await approvalService.approveOrganization(itemId, action, itemNotes);
      } else {
        await approvalService.approveRecruiter(itemId, action, itemNotes);
      }

      toast.success(`${type === 'organization' ? 'Company' : 'Recruiter'} ${action}d successfully`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error(`Failed to ${action} ${type}:`, error);
      toast.error(`Failed to ${action} ${type}`);
    }
  };

  const handleBulkAction = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select items to process');
      return;
    }

    try {
      const organizationIds = selectedItems.filter(id => 
        pendingApprovals.organizations.some(org => org.id === id)
      );

      if (organizationIds.length > 0) {
        await approvalService.bulkApproveOrganizations(
          organizationIds, 
          currentAction, 
          notes
        );
        toast.success(`${organizationIds.length} companies ${currentAction}d successfully`);
      }

      setSelectedItems([]);
      setShowNotesModal(false);
      setNotes('');
      setCurrentAction(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to bulk process:', error);
      toast.error('Failed to process bulk action');
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (activeTab === 'organizations') {
      const orgIds = pendingApprovals.organizations.map(org => org.id);
      setSelectedItems(selectedItems.length === orgIds.length ? [] : orgIds);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      approved: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: ClockIcon,
      approved: CheckCircleIcon,
      rejected: XCircleIcon
    };
    return icons[status] || ClockIcon;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner variant="dots" size="large" text="Loading approvals..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Approval Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage company and recruiter approvals for {user?.organization?.name}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Companies</dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {approvalStats.organizations?.find(s => s.approvalStatus === 'pending')?.count || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Recruiters</dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {approvalStats.recruiters?.find(s => s.approvalStatus === 'pending')?.count || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Approved</dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {(approvalStats.organizations?.find(s => s.approvalStatus === 'approved')?.count || 0) +
                       (approvalStats.recruiters?.find(s => s.approvalStatus === 'approved')?.count || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Pending</dt>
                    <dd className="text-2xl font-bold text-gray-900">{pendingApprovals.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs and Content */}
        <div className="bg-white shadow rounded-lg">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('organizations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'organizations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BuildingOfficeIcon className="h-5 w-5" />
                  <span>Companies ({pendingApprovals.organizations.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('recruiters')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'recruiters'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-5 w-5" />
                  <span>Recruiters ({pendingApprovals.recruiters.length})</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Bulk Actions */}
          {activeTab === 'organizations' && pendingApprovals.organizations.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === pendingApprovals.organizations.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Select All ({selectedItems.length}/{pendingApprovals.organizations.length})
                    </span>
                  </label>
                </div>
                {selectedItems.length > 0 && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setCurrentAction('approve');
                        setShowNotesModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Approve Selected ({selectedItems.length})
                    </button>
                    <button
                      onClick={() => {
                        setCurrentAction('reject');
                        setShowNotesModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Reject Selected ({selectedItems.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {activeTab === 'organizations' ? (
              // Organizations Tab
              <div className="space-y-4">
                {pendingApprovals.organizations.length > 0 ? (
                  pendingApprovals.organizations.map((org) => (
                    <div key={org.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(org.id)}
                            onChange={() => handleSelectItem(org.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex items-center space-x-3">
                            {org.logoUrl ? (
                              <img src={org.logoUrl} alt={org.name} className="h-12 w-12 rounded-lg object-cover" />
                            ) : (
                              <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{org.name}</h3>
                              <p className="text-sm text-gray-600">{org.contactEmail}</p>
                              <p className="text-sm text-gray-500">{org.address}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(org.approvalStatus)}`}>
                            {org.approvalStatus}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove(org.id, 'organization', 'approve')}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              <CheckIcon className="h-4 w-4 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(org.id, 'organization', 'reject')}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XMarkIcon className="h-4 w-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No pending company approvals</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      All companies have been processed.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Recruiters Tab
              <div className="space-y-4">
                {pendingApprovals.recruiters.length > 0 ? (
                  pendingApprovals.recruiters.map((recruiter) => (
                    <div key={recruiter.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3">
                            <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <UserGroupIcon className="h-6 w-6 text-gray-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {recruiter.firstName} {recruiter.lastName}
                              </h3>
                              <p className="text-sm text-gray-600">{recruiter.email}</p>
                              <p className="text-sm text-gray-500">
                                {recruiter.organization?.name} • {recruiter.recruiterProfile?.designation}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(recruiter.approvalStatus)}`}>
                            {recruiter.approvalStatus}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove(recruiter.id, 'recruiter', 'approve')}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              <CheckIcon className="h-4 w-4 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(recruiter.id, 'recruiter', 'reject')}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XMarkIcon className="h-4 w-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No pending recruiter approvals</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      All recruiters have been processed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowNotesModal(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {currentAction === 'approve' ? 'Approve' : 'Reject'} Selected Companies
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {currentAction === 'approve' 
                          ? 'Add optional notes for approval (optional)'
                          : 'Add notes explaining the rejection reason (recommended)'
                        }
                      </p>
                      <textarea
                        rows={4}
                        className="mt-2 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder={currentAction === 'approve' ? 'Approval notes...' : 'Rejection reason...'}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleBulkAction}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    currentAction === 'approve' 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  }`}
                >
                  {currentAction === 'approve' ? 'Approve' : 'Reject'} ({selectedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalManagement;
