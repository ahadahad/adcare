import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { brand } from '../config/brand';
import { useLanguage } from '../i18n';
import { Icon } from './Icon';

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const { copy } = useLanguage();
  return <Link to="/" className="brand-lockup" aria-label={`${brand.name} — ${copy.nav.home}`}>
    <span className="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 4.5h8.2l3.3 3.4v11.6H6.5z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round"/><path d="M14.5 4.8v4h3.3M9.3 12.1h5.9M9.3 15.5h5.9" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round"/><path d="m4 8.5 2.5-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span>
    {!compact && <span>{brand.name}</span>}
  </Link>;
}

function LanguageSwitch() {
  const { language, setLanguage, copy } = useLanguage();
  return <div className="language-switch" role="group" aria-label={copy.language.label}>
    <button type="button" onClick={() => setLanguage('en')} aria-label={copy.language.english} aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''}>EN</button>
    <button type="button" onClick={() => setLanguage('bn')} aria-label={copy.language.bangla} aria-pressed={language === 'bn'} className={language === 'bn' ? 'active' : ''}>বাংলা</button>
  </div>;
}

export function Header({ app = false }: { app?: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { copy } = useLanguage();
  const close = () => setOpen(false);
  const toolLinks = [
    { to: '/photo-studio', title: copy.nav.photo, detail: copy.nav.photoDetail, icon: 'camera' as const },
    { to: '/a4-print', title: copy.nav.a4, detail: copy.nav.a4Detail, icon: 'document' as const },
    { to: '/nid-print', title: copy.nav.nid, detail: copy.nav.nidDetail, icon: 'id' as const },
  ];
  const cta = <Link className="button button-primary" to="/photo-studio" onClick={close}>{app ? copy.nav.openTool : copy.nav.start} <Icon name="arrowUpRight" size={16} /></Link>;

  return <header className={app ? 'tool-shell-header' : 'site-header'}>
    <div className={app ? 'tool-shell-inner' : 'header-inner'}>
      <BrandLockup />
      <LanguageSwitch />
      {app ? <nav className="tool-shell-links" aria-label={copy.nav.tools}>
        <Link to="/#tools" className="tool-back"><Icon name="arrow" size={15} /> {copy.nav.back}</Link>
        <Link to="/help">{copy.nav.help}</Link>
        <Link to="/about">{copy.nav.about}</Link>
      </nav> : <>
        <nav className="primary-nav" aria-label={copy.nav.tools}>
          <details className="nav-dropdown">
            <summary>{copy.nav.tools} <Icon name="chevron" size={13} /></summary>
            <div className="nav-menu" role="menu">
              {toolLinks.map((item) => <Link role="menuitem" key={item.to} to={item.to} onClick={close}>
                <Icon name={item.icon} size={18} /><span>{item.title}<small>{item.detail}</small></span>
              </Link>)}
            </div>
          </details>
          <Link to="/help">{copy.nav.help}</Link>
          <Link to="/about">{copy.nav.about}</Link>
        </nav>
        <div className="header-actions">{cta}</div>
        <button className="mobile-menu-button" aria-label={copy.nav.tools} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Icon name={open ? 'close' : 'menu'} size={19} />
        </button>
      </>}
      {!app && open && <nav className="mobile-nav" aria-label={copy.nav.tools}>
        <Link to="/#tools" onClick={close}>{copy.nav.explore}</Link>
        {toolLinks.map((item) => <Link key={item.to} to={item.to} onClick={close}>{item.title}</Link>)}
        <Link to="/help" onClick={close}>{copy.nav.help}</Link>
        <Link to="/about" onClick={close}>{copy.nav.about}</Link>
        {cta}
      </nav>}
    </div>
  </header>;
}
