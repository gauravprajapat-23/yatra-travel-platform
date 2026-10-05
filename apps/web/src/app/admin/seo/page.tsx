import { AdminShell } from "@/components/admin-shell";

export default function SeoPage(){
 return <AdminShell active="SEO Manager" title="SEO Manager" subtitle="Manage page metadata, structured data and search engine settings." actions={<button className="admin-secondary-button">View Website ↗</button>}>
   <div className="admin-tabs-bar">{["Pages","Global Settings","Schema Markup","Sitemap","SEO Tools"].map((x,i)=><button className={i===0?"is-active":""} key={x}>{x}</button>)}</div>
   <div className="admin-seo-grid">
     <section className="admin-panel admin-seo-form"><label>Select Page<select><option>Manali Tour Package</option></select></label><p className="admin-page-url">https://www.yatra.com/tours/manali-tour-package <a>View Page →</a></p><h2>SEO Metadata</h2><label>SEO Title <span>52/60</span><input defaultValue="Manali Tour Package | Best Manali Holiday Tour | YATRA"/></label><label>Meta Description <span>128/160</span><textarea defaultValue="Explore our Manali tour package with curated itineraries, hotel stays, sightseeing and comfortable transport."/></label><label>Keywords<input defaultValue="manali tour, manali package, manali holiday, kullu manali"/></label></section>
     <section className="admin-panel admin-seo-score"><h2>SEO Score</h2><div className="admin-score-ring"><div><strong>92</strong><span>Excellent</span></div></div>{["Meta title optimized","Meta description optimized","Focus keywords added","Images have alt text","Schema markup enabled","Page is indexable"].map(x=><p key={x}>✓ {x}</p>)}<a>View SEO Suggestions →</a></section>
   </div>
   <div className="admin-seo-bottom"><section className="admin-panel"><div className="admin-panel-heading"><h2>Schema / Structured Data</h2><span>Enabled</span></div><div className="admin-card-body"><label>Schema type<select><option>TouristTrip</option></select></label><p>✓ Valid schema markup</p><p>✓ Rich results eligible</p><button className="admin-secondary-button">Preview Code</button></div></section><section className="admin-panel"><div className="admin-panel-heading"><h2>Sitemap & Indexing</h2></div><div className="admin-card-body"><p>Index Status <strong>Indexable</strong></p><p>Last Crawled <strong>12 Oct 2024, 10:24 AM</strong></p><label>Canonical URL<input defaultValue="https://www.yatra.com/tours/manali-tour-package"/></label></div></section></div>
 </AdminShell>;
}
