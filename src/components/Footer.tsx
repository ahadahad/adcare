import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { useLanguage } from '../i18n';
import { BrandLockup } from './Header';

export function Footer() {
  const { copy } = useLanguage();
  const f = copy.footer;
  return <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-top">
        <div className="footer-brand"><BrandLockup /><p className="footer-brand-copy">{f.tagline} {f.description}</p></div>
        <div className="footer-column"><strong>{f.tools}</strong><Link to="/photo-studio">{copy.nav.photo}</Link><Link to="/a4-print">{copy.nav.a4}</Link><Link to="/nid-print">{copy.nav.nid}</Link></div>
        <div className="footer-column"><strong>{f.resources}</strong><Link to="/help">{copy.nav.help}</Link><Link to="/about">{f.about} {brand.shortName}</Link></div>
        <div className="footer-column"><strong>{f.information}</strong><Link to="/about#privacy">{f.privacy}</Link><Link to="/about#terms">{f.terms}</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {brand.name}. {f.rights}</span><span className="footer-legal"><Link to="/about#privacy">{f.privacy}</Link><Link to="/about#terms">{f.terms}</Link></span></div>
    </div>
  </footer>;
}
