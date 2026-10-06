import { useEffect, type ComponentType, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Icon, type IconName } from '../components/Icon';
import { ToolStage } from '../components/ToolStage';
import { Footer } from '../components/Footer';
import { brand } from '../config/brand';
import { useLanguage } from '../i18n';
import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import HelpPage from '../pages/HelpPage';
import NotFoundPage from '../pages/NotFoundPage';

type ToolLabel = 'photo' | 'a4' | 'nid';
const toolRoutes: { path: string; label: ToolLabel; icon: IconName; load: () => Promise<{ default: ComponentType; styles: string }> }[] = [
  { path: '/photo-studio', label: 'photo', icon: 'camera', load: () => import('../tool-entries/photo-studio') },
  { path: '/a4-print', label: 'a4', icon: 'document', load: () => import('../tool-entries/a4-print') },
  { path: '/nid-print', label: 'nid', icon: 'id', load: () => import('../tool-entries/nid-print') },
];

function Metadata() {
  const { pathname } = useLocation();
  const { language, copy } = useLanguage();
  useEffect(() => {
    const routeMeta: Record<string, { title: string; description: string }> = {
      '/': { title: copy.meta.home, description: copy.meta.homeDescription },
      '/photo-studio': { title: copy.meta.photo, description: copy.meta.photoDescription },
      '/a4-print': { title: copy.meta.a4, description: copy.meta.a4Description },
      '/nid-print': { title: copy.meta.nid, description: copy.meta.nidDescription },
      '/about': { title: copy.meta.about, description: copy.meta.aboutDescription },
      '/help': { title: copy.meta.help, description: copy.meta.helpDescription },
    };
    const page = routeMeta[pathname] || { title: copy.meta.notFound, description: copy.meta.notFoundDescription };
    document.title = `${brand.name} — ${page.title}`;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    description.content = page.description;
    document.documentElement.style.setProperty('--green', brand.colors.primary);
    document.documentElement.style.setProperty('--green-dark', brand.colors.primaryDark);
    document.documentElement.style.setProperty('--gold', brand.colors.secondary);
  }, [pathname, language, copy]);
  return null;
}

function ToolRoute({ tool }: { tool: (typeof toolRoutes)[number] }) {
  const { copy } = useLanguage();
  const label = copy.nav[tool.label];
  return <div className="tool-product-frame">
    <Header app />
    <nav className="tool-switcher" aria-label={copy.nav.switchTools}><div className="tool-switcher-inner"><span className="tool-switch-label">{copy.nav.tools}</span>{toolRoutes.map((item) => <Link key={item.path} to={item.path} className={`tool-switch-link${tool.path === item.path ? ' active' : ''}`} aria-current={tool.path === item.path ? 'page' : undefined}><Icon name={item.icon} size={14} />{copy.nav[item.label]}</Link>)}</div></nav>
    <ToolStage key={tool.path} load={tool.load} label={label} />
  </div>;
}

function MarketingPage({ children }: { children: ReactNode }) {
  return <><Header /><main className="main-content">{children}</main><Footer /></>;
}

export default function App() {
  return <div className="page-frame">
    <Metadata />
    <Routes>
      <Route path="/" element={<MarketingPage><HomePage /></MarketingPage>} />
      <Route path="/about" element={<MarketingPage><AboutPage /></MarketingPage>} />
      <Route path="/help" element={<MarketingPage><HelpPage /></MarketingPage>} />
      {toolRoutes.map((tool) => <Route key={tool.path} path={tool.path} element={<ToolRoute tool={tool} />} />)}
      <Route path="*" element={<MarketingPage><NotFoundPage /></MarketingPage>} />
    </Routes>
  </div>;
}
