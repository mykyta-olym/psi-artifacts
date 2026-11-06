import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ThemePanel = ({ themePref, setThemePref }) => {
    const applyTheme = (pref) => {
        setThemePref?.(pref);
    };

    return (
        <section className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Appearance</h3>
                <Icon name="SunMoon" size={18} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <Button
                    variant={themePref === 'system' ? 'default' : 'outline'}
                    onClick={() => applyTheme('system')}
                >
                    System
                </Button>
                <Button
                    variant={themePref === 'light' ? 'default' : 'outline'}
                    onClick={() => applyTheme('light')}
                >
                    Light
                </Button>
                <Button
                    variant={themePref === 'dark' ? 'default' : 'outline'}
                    onClick={() => applyTheme('dark')}
                >
                    Dark
                </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                Your choice is stored with your account and applied instantly.
            </p>
        </section>
    );
};

export default ThemePanel;