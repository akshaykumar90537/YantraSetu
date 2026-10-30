import React, { useState } from 'react';
import { ArrowUpRight, ArrowRight, Sprout, Tractor, Wheat, Layers, Droplets, MapPin, CalendarDays, ShieldCheck, Check, Menu, X, Plus, Minus } from 'lucide-react';
import { TractorArt } from './TractorArt';
import './HomePage.css';

const equipment = [
  { name: 'Tractors', icon: Tractor, tag: 'THE FIELD ESSENTIAL', title: 'Big jobs. The right horsepower.', description: 'From land preparation to transport, find a tractor suited to your next job.', uses: ['Land preparation', 'Farm transport', 'Attachment support'], color: 'tractor' },
  { name: 'Harvesters', icon: Wheat, tag: 'WHEN TIMING MATTERS', title: 'Make the most of harvest time.', description: 'Explore harvesting equipment and plan your slot around your crop and season.', uses: ['Crop harvesting', 'Seasonal planning', 'Time-slot booking'], color: 'harvest' },
  { name: 'Implements', icon: Layers, tag: 'PREPARE FOR WHAT’S NEXT', title: 'A good season starts with the soil.', description: 'Explore implements for your field work. Confirm compatibility and attachments with the owner.', uses: ['Soil preparation', 'Field cultivation', 'Attachment planning'], color: 'implement' },
  { name: 'Sprayers', icon: Droplets, tag: 'CARE FOR EVERY ACRE', title: 'Give your crop the attention it needs.', description: 'Find spraying equipment and discuss your field requirements with the equipment owner.', uses: ['Crop care', 'Field coverage', 'Scheduled rental'], color: 'sprayer' },
];
const journeys = {
  farmer: { label: 'For farmers', title: 'Your field. Your schedule.', intro: 'Spend less time arranging equipment and more time planning a good day’s work.', steps: [['Find nearby equipment', 'Search by equipment type and distance from your farm.'], ['Request your time slot', 'Choose when you need it and wait for the owner’s approval.'], ['Finish with a clear bill', 'Confirm meter readings and keep a record of the rental.']], cta: 'Find my next machine' },
  owner: { label: 'For equipment owners', title: 'Put idle equipment to work.', intro: 'Bring your listings, booking requests and rental records into one workspace.', steps: [['Create your listing', 'Add your equipment, location, rental rate and availability.'], ['Manage incoming requests', 'Accept or reject bookings around your own work schedule.'], ['Track every rental', 'Record readings, generate bills and review rental earnings.']], cta: 'Start listing equipment' },
};
const faqs = [
  ['Can I rent equipment and list my own?', 'Yes. Choose both farmer and owner roles when creating your account to rent equipment and manage your own listings.'],
  ['How is the final rental bill calculated?', 'The booking uses the equipment’s saved rental rate. Hourly rentals use confirmed start and end meter readings; per-acre rentals use the completed acreage. Applicable listed charges are included in the breakdown.'],
  ['Do I pay through YantraSetu?', 'Payments are arranged directly between the farmer and equipment owner. YantraSetu keeps rental bills and manually reported payment statuses; it does not collect money or independently verify those payments.'],
  ['Is a requested time slot immediately confirmed?', 'A request is pending until the owner approves it. Check your booking status before making plans to collect or use the equipment.'],
];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function HomePage({ onSignIn, lang = 'en', setLang }) {
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState(0);
  const [role, setRole] = useState('farmer');
  const [unit, setUnit] = useState('hour');
  const [quantity, setQuantity] = useState(4);
  const [rate, setRate] = useState('650');
  const [transport, setTransport] = useState('250');
  const [faq, setFaq] = useState(null);
  const machine = equipment[selected];
  const journey = journeys[role];
  const rateNumber = Number(rate);
  const transportNumber = Number(transport);
  const validEstimate = rate !== '' && transport !== '' && Number.isFinite(rateNumber) && rateNumber >= 0 && rateNumber <= 100000 && Number.isFinite(transportNumber) && transportNumber >= 0 && transportNumber <= 100000;
  return <div className="ys-home" id="ys-top">
    <a className="ys-skip" href="#ys-main">Skip to content</a>
    <header className="ys-nav">
      <a className="ys-logo" href="#ys-top" aria-label="YantraSetu home"><span><Sprout size={25} /></span><div>YantraSetu<small>GROW TOGETHER.</small></div></a>
      <nav className={menu ? 'ys-links is-open' : 'ys-links'} aria-label="Main navigation">
        {[['Equipment','#ys-equipment'],['How it works','#ys-how'],['Rental estimate','#ys-estimate'],['FAQs','#ys-faq']].map(([label,href]) => <a href={href} key={href} onClick={() => setMenu(false)}>{label}</a>)}
      </nav>
      <div className="ys-nav-actions">{setLang && <select className="ys-language" aria-label="Language" value={lang} onChange={e => setLang(e.target.value)}><option value="en">EN</option><option value="hi">हिन्दी</option><option value="pa">ਪੰਜਾਬੀ</option></select>}<button className="ys-btn ys-btn-dark" onClick={onSignIn}>Sign in <ArrowUpRight size={16} /></button><button className="ys-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>
    </header>
    <main id="ys-main">
      <section className="ys-hero">
        <div className="ys-hero-copy"><span className="ys-eyebrow"><span className="ys-dot" /> ROOTED IN COMMUNITY. BUILT FOR YOUR FARM.</span><h1>Good equipment.<br />Great possibilities.<br /><em>Growing together.</em></h1><p>Your next job deserves the right machine. Connect with equipment owners nearby and turn your plans into a productive day in the field.</p><div className="ys-actions"><button className="ys-btn ys-btn-lime" onClick={onSignIn}>Find equipment <ArrowUpRight size={19} /></button><a className="ys-text-link" href="#ys-how">See how it works <ArrowRight size={17} /></a></div><div className="ys-hero-foot"><span><MapPin size={15} /> Start with nearby equipment</span><span><ShieldCheck size={15} /> Clear rental records</span></div></div>
        <div className="ys-hero-scene" aria-label="Illustrated tractor in farmland"><div className="ys-scene-label"><span className="ys-dot" /> A BETTER DAY IN THE FIELD</div><div className="ys-hill ys-hill-back" /><div className="ys-hill ys-hill-front" /><TractorArt large /><div className="ys-scene-card"><span className="ys-scene-icon"><CalendarDays size={21} /></span><div><strong>Plan. Book. Get to work.</strong><small>One place for your next rental.</small></div><ArrowUpRight size={21} /></div><span className="ys-scene-caption">LOCAL CONNECTIONS. SHARED OPPORTUNITIES.</span></div>
      </section>
      <div className="ys-principles"><span><Tractor /> Equipment for every stage</span><span><CalendarDays /> Book around your schedule</span><span><ShieldCheck /> Meter-based billing</span><span><Sprout /> Farmers & owners, connected</span></div>

      <section className="ys-section" id="ys-equipment"><div className="ys-section-head"><div><span className="ys-eyebrow">01 / FIND YOUR FIT</span><h2>What’s next for your field?</h2></div><p>Explore the possibilities. Sign in to check actual listings, rates and availability near you.</p></div>
        <div className="ys-equipment-tabs" aria-label="Equipment categories">{equipment.map((item,i) => <button key={item.name} aria-pressed={selected===i} className={selected===i ? 'is-selected' : ''} onClick={() => setSelected(i)}><item.icon size={24} /><span>{item.name}</span><ArrowUpRight size={16} /></button>)}</div>
        <div className={`ys-equipment-detail ys-${machine.color}`}><div className="ys-equipment-visual"><machine.icon size={112} strokeWidth={1} /><span>{machine.name.toUpperCase()}</span><span className="ys-visual-number">0{selected+1}</span></div><div className="ys-equipment-copy" aria-live="polite"><span className="ys-eyebrow">{machine.tag}</span><h3>{machine.title}</h3><p>{machine.description}</p><div className="ys-pills">{machine.uses.map(use => <span key={use}><Check size={13} />{use}</span>)}</div><button className="ys-text-link" onClick={onSignIn}>Sign in to explore equipment <ArrowUpRight size={18} /></button></div></div>
      </section>

      <section className="ys-how-wrap" id="ys-how"><div className="ys-section"><div className="ys-section-head"><div><span className="ys-eyebrow">02 / A SIMPLER WAY TO WORK</span><h2>Two sides. One community.</h2></div><div className="ys-role-switch" aria-label="Choose your perspective">{Object.entries(journeys).map(([key,value]) => <button key={key} aria-pressed={role===key} onClick={() => setRole(key)}>{value.label}</button>)}</div></div><div className="ys-journey" aria-live="polite"><div><h3>{journey.title}</h3><p>{journey.intro}</p><button className="ys-btn ys-btn-dark" onClick={onSignIn}>{journey.cta}<ArrowUpRight size={17} /></button></div><ol>{journey.steps.map(([title,body],i) => <li key={title}><span>0{i+1}</span><div><h4>{title}</h4><p>{body}</p></div></li>)}</ol></div></div></section>

      <section className="ys-section ys-calculator" id="ys-estimate"><div><span className="ys-eyebrow">03 / CLARITY BEFORE YOU COMMIT</span><h2>A little planning.<br />A clearer rental cost.</h2><p>Try an example before you book. Adjust the rate and work quantity to see how a rental estimate adds up.</p><div className="ys-estimate-note"><ShieldCheck size={22} /><p>This is an illustrative calculator, not a quote. Actual rates, availability, add-ons and final bills come from your booking.</p></div></div><div className="ys-estimate-card"><div className="ys-estimate-top"><h3>Try a rental estimate</h3><span>EXAMPLE</span></div><div className="ys-estimate-inputs"><label>Pricing unit<select value={unit} onChange={e => setUnit(e.target.value)}><option value="hour">Per hour</option><option value="acre">Per acre</option></select></label><label>Rate per {unit} (₹)<input type="number" min="0" max="100000" step="1" value={rate} onChange={e => setRate(e.target.value)} /></label></div><label className="ys-range-label" htmlFor="ys-quantity">{unit==='hour' ? 'Working hours' : 'Completed acres'}<strong>{quantity} {unit}{quantity!==1?'s':''}</strong></label><input id="ys-quantity" type="range" min="1" max="24" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /><label className="ys-transport">Transport / mobilization (₹)<input type="number" min="0" max="100000" step="1" value={transport} onChange={e => setTransport(e.target.value)} /></label><div className="ys-total" aria-live="polite"><div><span>Illustrative total</span><small>{validEstimate ? `${quantity} × ${money(rateNumber)} + ${money(transportNumber)}` : 'Enter amounts from ₹0 to ₹1,00,000.'}</small></div><strong>{validEstimate ? money(quantity*rateNumber+transportNumber) : '—'}</strong></div><p>Payment is arranged directly with the owner.</p></div></section>

      <section className="ys-section ys-faq" id="ys-faq"><div><span className="ys-eyebrow">A FEW THINGS TO KNOW</span><h2>Before you <br />head to the field.</h2><p>Simple answers for your first rental.</p></div><div>{faqs.map(([q,a],i) => <div className="ys-faq-item" key={q}><h3><button aria-expanded={faq===i} aria-controls={`ys-answer-${i}`} onClick={() => setFaq(faq===i?null:i)}>{q}{faq===i ? <Minus size={18} /> : <Plus size={18} />}</button></h3><div id={`ys-answer-${i}`} hidden={faq!==i}><p>{a}</p></div></div>)}</div></section>
      <section className="ys-final"><Sprout size={42} strokeWidth={1.3} /><span className="ys-eyebrow">THE NEXT SEASON STARTS WITH A CONNECTION</span><h2>Let’s make a good<br />day’s work happen.</h2><button className="ys-btn ys-btn-lime" onClick={onSignIn}>Get started with YantraSetu <ArrowUpRight size={18} /></button><p>Rent equipment. Share opportunity. Grow together.</p></section>
    </main>
    <footer className="ys-footer"><a className="ys-logo" href="#ys-top"><Sprout /><div>YantraSetu<small>AGRICULTURE, CONNECTED.</small></div></a><p>Built for the people who keep our fields moving.</p><a href="#ys-top">Back to top ↑</a></footer>
  </div>;
}
