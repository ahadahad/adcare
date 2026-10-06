import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useLanguage } from '../i18n';

const toolVisuals = [
  { to: '/photo-studio', icon: 'camera' as IconName, tone: 'mint' },
  { to: '/a4-print', icon: 'document' as IconName, tone: 'sand' },
  { to: '/nid-print', icon: 'id' as IconName, tone: 'blue' },
];

function PortraitGlyph() {
  return <svg viewBox="0 0 96 124" className="portrait-glyph" aria-hidden="true"><rect width="96" height="124" rx="8" fill="#e5e8df"/><path d="M13 124c2-27 15-39 35-39s34 12 36 39" fill="#748e81"/><path d="M26 43c0-21 9-31 22-31 17 0 24 13 23 31l-4 22c-3 14-11 22-20 22-10 0-18-8-21-22z" fill="#e4b99b"/><path d="M25 47c-3-19 1-37 18-41 17-5 31 8 31 26-7-2-12-7-14-14-7 9-20 14-35 14z" fill="#302c2a"/><circle cx="40" cy="51" r="1.5" fill="#352f2b"/><circle cx="58" cy="51" r="1.5" fill="#352f2b"/><path d="M42 66q6 4 12 0" stroke="#a46d5b" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>;
}

function HeroPreview() {
  const { copy } = useLanguage();
  const p = copy.home.preview;
  return <div className="preview-stage" aria-label={copy.home.previewDescription}>
    <div className="preview-caption"><span className="preview-dot" /> {p.kicker} <span>{p.title}</span></div>
    <div className="preview-canvas">
      <div className="preview-photo-card">
        <div className="preview-window-bar"><span /><span /><span /><b>{copy.nav.photo}</b><i>•••</i></div>
        <div className="preview-photo-body"><div className="preview-tool-rail"><i /><i /><i /><i /></div><div className="passport-sheet"><PortraitGlyph /><span className="guide-line guide-top" /><span className="guide-line guide-bottom" /></div><div className="preview-photo-side"><b>{p.passport}</b><small>51 × 51 mm</small><span className="setting-row"><i /> {p.background}</span><span className="setting-row"><i /> {p.adjustments}</span><span className="setting-row"><i /> {p.export}</span><em><Icon name="check" size={12} /> {p.ready}</em></div></div>
      </div>
      <div className="preview-a4-card">
        <div className="preview-window-bar"><span /><span /><span /><b>{copy.nav.a4}</b><i>↗</i></div>
        <div className="preview-a4-body"><div className="paper-sheet"><div className="paper-head"><span>{copy.nav.a4.toUpperCase()}</span><i>01</i></div><div className="paper-rule wide" /><div className="paper-rule" /><div className="paper-rule mid" /><div className="paper-block" /><div className="paper-rule wide" /><div className="paper-rule short" /><div className="paper-stamp">A4</div><span className="crop-corner tl" /><span className="crop-corner tr" /><span className="crop-corner bl" /><span className="crop-corner br" /></div><div className="a4-tool-controls"><b>{p.documentTools}</b><span><Icon name="scan" size={13} /> {p.autoDetect}</span><span><Icon name="crop" size={13} /> {p.adjustCrop}</span><span><Icon name="printer" size={13} /> {p.printLayout}</span><button>{p.exportPdf}</button></div></div>
      </div>
      <div className="preview-id-card">
        <div className="preview-id-top"><span className="id-emblem">ID</span><span><b>{p.nid}</b><small>{p.frontBack}</small></span><i><Icon name="arrowUpRight" size={13} /></i></div>
        <div className="id-mini-pair"><div className="id-mini"><div className="id-mini-head" /><div className="id-mini-photo"><PortraitGlyph /></div><div className="id-mini-lines"><i /><i /><i /></div><span>{p.front}</span></div><div className="id-mini back"><div className="id-mini-head" /><div className="id-mini-lines"><i /><i /><i /><i /></div><span>{p.back}</span></div></div>
      </div>
      <div className="preview-note"><span><Icon name="lock" size={13} /></span><b>{p.designed}</b><small>{p.local}</small></div>
      <div className="preview-ring ring-one" /><div className="preview-ring ring-two" />
    </div>
    <div className="preview-legend"><span><i className="legend-green" /> {p.workspaces}</span><span>{p.upload}</span></div>
  </div>;
}

export default function HomePage() {
  const { copy } = useLanguage();
  const h = copy.home;
  return <div className="home-page page-enter">
    <section className="hero-section">
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-mark" /> {h.kicker}</div>
          <h1>{h.title} <em>{h.accent}</em></h1>
          <p className="hero-description">{h.description}</p>
          <div className="hero-actions"><Link to="/photo-studio" className="button button-primary">{h.start} <Icon name="arrow" size={16} /></Link><a href="#tools" className="button button-secondary">{h.explore}</a></div>
          <div className="hero-assurance"><Icon name="lock" size={15} /><span>{h.browserNote}</span><i /></div>
        </div>
        <HeroPreview />
      </div>
      <div className="hero-bottom-line"><span>{h.ribbonPrefix}</span><b>{h.ribbonPhoto}</b><i /> <b>{h.ribbonDocument}</b><i /> <b>{h.ribbonLayouts}</b></div>
    </section>

    <section id="tools" className="tools-section section-pad">
      <div className="section-heading-row"><div><span className="section-kicker">{h.workspace.kicker}</span><h2 className="section-title">{h.workspace.title}<br /><em>{h.workspace.accent}</em></h2></div><p className="section-intro">{h.workspace.intro}</p></div>
      <div className="tool-card-grid">{h.tools.map((tool, index) => <article className={`product-card ${toolVisuals[index].tone}`} key={toolVisuals[index].to}>
        <div className="product-card-top"><span className="product-icon"><Icon name={toolVisuals[index].icon} size={21} /></span><span className="card-index">0{index + 1}</span></div>
        <h3>{tool.title}</h3><p>{tool.description}</p>
        <ul>{tool.features.map((feature) => <li key={feature}><Icon name="check" size={13} />{feature}</li>)}</ul>
        <Link className="product-card-link" to={toolVisuals[index].to}>{tool.link}<Icon name="arrow" size={16} /></Link>
      </article>)}</div>
    </section>

    <section className="how-section section-pad">
      <div className="how-heading"><span className="section-kicker">{h.flow.kicker}</span><h2 className="section-title">{h.flow.title} <em>{h.flow.accent}</em></h2></div>
      <div className="steps-grid">{h.flow.steps.map((step, index) => <article key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>)}</div>
    </section>

    <section className="privacy-band"><div className="privacy-inner"><div className="privacy-icon"><Icon name="shield" size={23} /></div><div><span className="section-kicker">{h.privacy.kicker}</span><h2>{h.privacy.title} <em>{h.privacy.accent}</em></h2><p>{h.privacy.description}</p></div><Link to="/about#privacy" className="privacy-link">{h.privacy.link} <Icon name="arrowUpRight" size={15} /></Link></div></section>

    <section className="features-section section-pad"><div className="section-heading-row"><div><span className="section-kicker">{h.featureSection.kicker}</span><h2 className="section-title">{h.featureSection.title}<br /><em>{h.featureSection.accent}</em></h2></div><p className="section-intro">{h.featureSection.description}</p></div><div className="feature-grid">
      {h.features.map((feature) => <article className="feature-item" key={feature.title}><span><Icon name={feature.icon as IconName} size={19} /></span><div><h3>{feature.title}</h3><p>{feature.description}</p></div></article>)}
    </div></section>

    <section className="use-cases-section"><div className="use-cases-inner"><div><span className="section-kicker">{h.useCases.kicker}</span><h2 className="section-title">{h.useCases.title}<br /><em>{h.useCases.accent}</em></h2></div><div className="use-case-list">{h.useCases.items.map((label, index) => <span key={label}><i>0{index + 1}</i>{label}</span>)}</div></div></section>

    <section className="final-cta"><div className="cta-mark"><Icon name="document" size={22} /></div><span className="section-kicker">{h.final.kicker}</span><h2>{h.final.title}</h2><p>{h.final.description}</p><div><Link to="/photo-studio" className="button button-primary">{h.final.open} <Icon name="arrow" size={16} /></Link><a href="#tools" className="button button-quiet">{h.final.explore}</a></div></section>
  </div>;
}
