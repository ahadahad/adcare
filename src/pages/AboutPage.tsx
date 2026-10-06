import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { Icon } from '../components/Icon';
import { useLanguage } from '../i18n';

export default function AboutPage() {
  const { copy } = useLanguage();
  const a = copy.about;
  return <div className="content-page page-enter">
    <span className="section-kicker">{a.kicker}</span>
    <h1 className="section-title">{a.title}<br /> <em>{a.accent}</em></h1>
    <p className="content-lead">{brand.name} {a.lead}</p>
    <div className="about-grid">
      <article className="content-card"><h2>{a.workspacesTitle}</h2><p>{a.workspaces}</p><p><Link to="/#tools">{a.explore} →</Link></p></article>
      <article className="content-card"><h2>{a.browserTitle}</h2><p>{a.browser}</p></article>
    </div>
    <section className="privacy-copy" id="privacy"><h2><Icon name="shield" size={19} /> {a.privacyTitle}</h2><p>{a.privacy}</p><p>{a.previewNote}</p></section>
    <section className="content-card" id="terms" style={{ marginTop: 20 }}><h2>{a.termsTitle}</h2><p>{a.terms}</p></section>
  </div>;
}
