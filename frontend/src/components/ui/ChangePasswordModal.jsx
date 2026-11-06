// src/components/ui/ChangePasswordModal.jsx
import React, { useState } from 'react';
import ModalBase from './ModalBase';
import Button from './Button';
import Icon from '../AppIcon';
import { useToasts } from './Toasts';
import { changePassword } from '../../data/userApi';

export default function ChangePasswordModal({ open, onClose, onSuccess }) {
  const { notify } = useToasts();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const validateForm = () => {
    const newErrors = { currentPassword: '', newPassword: '', confirmPassword: '' };
    let isValid = true;

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
      isValid = false;
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
      isValid = false;
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/[A-Z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one uppercase letter';
      isValid = false;
    } else if (!/[a-z]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one lowercase letter';
      isValid = false;
    } else if (!/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain at least one number';
      isValid = false;
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const passwordStrength = calculatePasswordStrength(newPassword);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      notify('success', 'Password changed successfully', { title: 'Success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onSuccess?.();
      onClose();
    } catch (error) {
      notify('error', error.message || 'Failed to change password', { title: 'Error' });
      setErrors({ ...errors, currentPassword: 'Current password is incorrect' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
    onClose();
  };

  return (
    <ModalBase
      open={open}
      onClose={handleCancel}
      title="Change Password"
      subtitle="Update your account security"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            <Icon name="x" className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Icon name="loader" className="w-4 h-4 animate-spin" />
                Changing...
              </>
            ) : (
              <>
                <Icon name="check" className="w-4 h-4" />
                Change Password
              </>
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-muted/50 dark:bg-muted/20 border border-border rounded-lg p-3">
          <div className="flex gap-2">
            <Icon name="info" className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>At least 8 characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="current-password" className="block text-sm font-medium text-foreground mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-foreground"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCurrent(!showCurrent);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name={showCurrent ? 'EyeOff' : 'Eye'} className="w-4 h-4" />
            </button>
          </div>
          {errors.currentPassword && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
              <Icon name="alert-circle" className="w-4 h-4" />
              <span>{errors.currentPassword}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-foreground"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNew(!showNew);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name={showNew ? 'EyeOff' : 'Eye'} className="w-4 h-4" />
            </button>
          </div>
          {errors.newPassword && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
              <Icon name="alert-circle" className="w-4 h-4" />
              <span>{errors.newPassword}</span>
            </div>
          )}

          {newPassword && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="shield" className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Password strength: <span className={`${strengthColors[passwordStrength - 1]?.replace('bg-', 'text-') || 'text-muted-foreground'}`}>
                    {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : 'Too weak'}
                  </span>
                </span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      level <= passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-foreground"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirm(!showConfirm);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name={showConfirm ? 'EyeOff' : 'Eye'} className="w-4 h-4" />
            </button>
          </div>
          {confirmPassword && newPassword === confirmPassword && (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
              <Icon name="check-circle" className="w-4 h-4" />
              <span>Passwords match</span>
            </div>
          )}
          {errors.confirmPassword && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
              <Icon name="alert-circle" className="w-4 h-4" />
              <span>{errors.confirmPassword}</span>
            </div>
          )}
        </div>
      </form>
    </ModalBase>
  );
}
