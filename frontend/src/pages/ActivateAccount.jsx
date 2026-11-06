// src/pages/ActivateAccount.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Icon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const ActivateAccount = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    
    const [status, setStatus] = useState('loading'); // loading, success, error, already-activated
    const [message, setMessage] = useState('');
    const [userInfo, setUserInfo] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    
    useEffect(() => {
        const activateAccount = async () => {
            if (!token || !email) {
                setStatus('error');
                setMessage('Invalid activation link. Missing token or email.');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/activate-account`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        token: token
                    }),
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    setStatus('success');
                    setMessage(data.message || 'Account activated successfully!');
                    setUserInfo({
                        email: data.email,
                        fullName: data.fullName,
                        userType: data.userType
                    });
                } else {
                    if (data.error?.includes('already activated')) {
                        setStatus('already-activated');
                        setMessage('This account has already been activated. You can log in now.');
                    } else if (data.error?.includes('expired')) {
                        setStatus('error');
                        setMessage('Your activation link has expired. Please contact the teaching staff to request a new one.');
                    } else {
                        setStatus('error');
                        setMessage(data.error || 'Failed to activate account. Please try again or contact support.');
                    }
                }
            } catch (err) {
                console.error('Activation error:', err);
                setStatus('error');
                setMessage('Network error. Please check your connection and try again.');
            }
        };
        
        activateAccount();
    }, [token, email]);
    
    const handleGoToLogin = () => {
        navigate('/login', { state: { email: email } });
    };
    
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center"
                    >
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon name="Loader2" size={32} className="text-primary animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Activating Your Account</h1>
                        <p className="text-muted-foreground">Please wait while we verify your activation link...</p>
                    </motion.div>
                );
                
            case 'success':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
                            <Icon name="CheckCircle" size={32} className="text-success" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Account Activated!</h1>
                        <p className="text-muted-foreground mb-6">{message}</p>
                        
                        {userInfo && (
                            <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon name="User" size={18} className="text-primary" />
                                    <span className="font-medium">Account Details</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Name:</span>
                                        <span className="font-medium">{userInfo.fullName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-medium">{userInfo.email}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Account Type:</span>
                                        <span className="font-medium capitalize">{userInfo.userType}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-3">
                            <Button
                                variant="default"
                                className="w-full"
                                iconName="LogIn"
                                onClick={handleGoToLogin}
                            >
                                Go to Login
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Use the temporary password from your email to log in, then change it in your profile settings.
                            </p>
                        </div>
                    </motion.div>
                );
                
            case 'already-activated':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon name="Info" size={32} className="text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Already Activated</h1>
                        <p className="text-muted-foreground mb-6">{message}</p>
                        
                        <Button
                            variant="default"
                            className="w-full"
                            iconName="LogIn"
                            onClick={handleGoToLogin}
                        >
                            Go to Login
                        </Button>
                    </motion.div>
                );
                
            case 'error':
            default:
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                            <Icon name="XCircle" size={32} className="text-destructive" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Activation Failed</h1>
                        <p className="text-muted-foreground mb-6">{message}</p>
                        
                        <div className="space-y-3">
                            <Button
                                variant="default"
                                className="w-full"
                                iconName="LogIn"
                                onClick={handleGoToLogin}
                            >
                                Go to Login
                            </Button>
                            <Link 
                                to="/" 
                                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Icon name="Home" size={16} />
                                Back to Home
                            </Link>
                        </div>
                    </motion.div>
                );
        }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                            <Icon name="GraduationCap" size={28} className="text-primary-foreground" />
                        </div>
                        <span className="text-2xl font-bold text-foreground">MAIS</span>
                    </Link>
                </div>
                
                {/* Card */}
                <div className="bg-card border border-border rounded-xl shadow-lg p-8">
                    {renderContent()}
                </div>
                
                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    Need help? Contact your institution's IT support.
                </p>
            </div>
        </div>
    );
};

export default ActivateAccount;
