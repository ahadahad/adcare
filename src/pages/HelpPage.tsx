import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';

export default function HelpPage() {
  const { copy, language } = useLanguage();
  const h = copy.help;
  return <div className="content-page page-enter">
    <span className="section-kicker">{h.kicker}</span>
    <h1 className="section-title">{h.title}<br /><em>{h.accent}</em></h1>
    <p className="content-lead">{h.intro}</p>
    <div className="faq-list">{h.questions.map(({ question, answer }) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    <div className="help-contact">{h.contactLead}{' '}<Link to="/about">{h.contactAbout}</Link>{language === 'bn' ? '' : ' '}{h.contactMiddle}{' '}<Link to="/photo-studio">{h.contactTool}</Link>{language === 'bn' ? '' : ' '}{h.contactEnd}</div>
  </div>;
}
