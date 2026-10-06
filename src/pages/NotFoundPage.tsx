import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useLanguage } from '../i18n';

export default function NotFoundPage() {
  const { copy } = useLanguage();
  const n = copy.notFound;
  return <main className="not-found page-enter"><div className="not-found-card"><div className="not-found-code">404</div><h1>{n.title}</h1><p>{n.description}</p><Link className="button button-primary" to="/#tools">{n.back} <Icon name="arrow" size={16} /></Link></div></main>;
}
