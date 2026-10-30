import React from 'react';

interface TopbarProps {
  onMenuToggle?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuToggle }) => {
  return (
    <header className="app-header">
      <button
        type="button"
        className="header-mobile-menu"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        style={{ display: 'none' }}
      />
    </header>
  );
};

export default Topbar;
