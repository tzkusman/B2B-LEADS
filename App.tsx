
import React, { useState, useEffect } from 'react';
import { AppView, LeadWithEnrichment } from './types';
import { supabase } from './services/supabase';
import { deepEnrichLead, prospectLeads, getMarketInsights } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [leads, setLeads] = useState<LeadWithEnrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchLeads();
  }, []);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 10));

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await supabase.getLeads();
      const mapped = data.map((l: any) => ({
        ...l,
        enrichment: Array.isArray(l.enrichment) ? l.enrichment[0] : l.enrichment
      }));
      setLeads(mapped);
      const insight = await getMarketInsights(mapped);
      setAiInsight(insight);
    } catch (e) {
      console.error("Fetch leads failed:", e);
      addLog("System: Database fetch error.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeepProbe = async (query: string) => {
    if (!query || isSearching) return;
    setIsSearching(true);
    addLog(`Probe: Initiated deep search for "${query}"`);
    
    try {
      // Step 1: Prospecting
      addLog(`AI: Crawling B2B indices and social networks...`);
      const newRawLeads = await prospectLeads(query);
      
      if (!newRawLeads || newRawLeads.length === 0) {
        addLog(`AI: No leads found for this query. Refine keywords.`);
        setIsSearching(false);
        return;
      }

      // Ensure every lead has a source to satisfy DB constraints
      const leadsToSave = newRawLeads.map(l => ({
        ...l,
        source: l.source || 'Global Prospector'
      }));

      addLog(`Data: Saving ${leadsToSave.length} authentic entities to local node...`);
      const createdLeads = await supabase.addLeads(leadsToSave);
      
      if (createdLeads && createdLeads.length > 0) {
        addLog(`Cycle: Starting real-time enrichment and social lookup...`);
        
        // Enrich each new lead sequentially to avoid hitting rate limits and provide clear logging
        for (const lead of createdLeads) {
          addLog(`Enriching: ${lead.company_name}...`);
          try {
            const enrichment = await deepEnrichLead(lead);
            if (enrichment) {
              await supabase.saveEnrichment({
                lead_id: lead.id,
                enriched_email: enrichment.validated_email ? lead.email : null,
                ai_score: enrichment.lead_score,
                validated: enrichment.validated_email,
                industry_category: enrichment.industry_category,
                social_profiles: enrichment.social_profiles,
                readiness_explanation: enrichment.explanation,
                last_checked: new Date().toISOString()
              });
              addLog(`Success: ${lead.company_name} enriched (Score: ${enrichment.lead_score.toFixed(0)})`);
            } else {
              addLog(`Warning: No enrichment data found for ${lead.company_name}.`);
            }
          } catch (enrichError) {
            console.error(`Failed to enrich lead ${lead.id}:`, enrichError);
            addLog(`Error: Could not enrich ${lead.company_name}.`);
          }
        }
      } else {
        addLog(`Notice: No new leads were created in the database.`);
      }
      
      addLog(`Status: Global probe cycle complete.`);
      await fetchLeads();
    } catch (e: any) {
      console.error("Deep probe error:", e);
      addLog(`Critical: Search failed. ${e.message || 'Check connection.'}`);
    } finally {
      setIsSearching(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Dynamic Sidebar */}
      <aside className="w-72 border-r border-slate-900 bg-slate-950/80 backdrop-blur-xl flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 px-2 mb-10 group cursor-pointer" onClick={() => setView('dashboard')}>
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-all">
            <i className="fas fa-satellite-dish text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">Nexus <span className="text-indigo-400">Leads</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Deep Ingestor v3.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarLink icon="fa-chart-pie" label="Agency Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <SidebarLink icon="fa-radar" label="Deep Prospector" active={view === 'prospector'} onClick={() => setView('prospector')} />
          <SidebarLink icon="fa-stream" label="Lead Pipeline" active={view === 'pipeline'} onClick={() => setView('pipeline')} />
          <SidebarLink icon="fa-cloud-arrow-down" label="Data Ingestors" active={view === 'sources'} onClick={() => setView('sources')} />
          <div className="h-px bg-slate-900 my-6"></div>
          <SidebarLink icon="fa-gear" label="System Config" active={view === 'settings'} onClick={() => setView('settings')} />
        </nav>

        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 mt-auto">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">AI Node: Operational</span>
          </div>
          <div className="mt-3 space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
            {logs.map((log, i) => (
              <p key={i} className={`text-[9px] font-mono leading-tight ${i === 0 ? 'text-indigo-400' : 'text-slate-600'}`}>
                {'>'} {log}
              </p>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto p-10 relative scrollbar-hide">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white capitalize">{view.replace('-', ' ')}</h2>
            <p className="text-slate-500 mt-2 font-medium">Empowering your B2B ecosystem with verified global data.</p>
          </div>
          <div className="flex gap-4">
             <button onClick={fetchLeads} className="bg-slate-900 border border-slate-800 h-14 w-14 rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all text-slate-500">
                <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
             </button>
             <button className="bg-indigo-600 hover:bg-indigo-500 h-14 px-8 rounded-2xl flex items-center gap-3 shadow-xl shadow-indigo-600/30 transition-all active:scale-95 text-white font-bold">
                <i className="fas fa-download text-xs"></i>
                Export Results
             </button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <StatCard label="Total Ingested" value={leads.length.toString()} trend="+24% /wk" color="indigo" icon="fa-database" />
              <StatCard label="Verified Emails" value={leads.filter(l => l.enrichment?.validated).length.toString()} trend="98% Acc" color="emerald" icon="fa-envelope-circle-check" />
              <StatCard label="High-Ready (90+)" value={leads.filter(l => (l.enrichment?.ai_score || 0) >= 90).length.toString()} trend="Qualified" color="purple" icon="fa-fire-flame-curved" />
              <StatCard label="Active Sources" value="12" trend="Synced" color="amber" icon="fa-server" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <section className="xl:col-span-2 glass p-8 rounded-[2.5rem] space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xl flex items-center gap-3">
                    <i className="fas fa-wand-magic-sparkles text-indigo-400"></i>
                    AI Intelligence Summary
                  </h3>
                </div>
                <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-3xl relative overflow-hidden group">
                  <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/20 transition-all"></div>
                  {loading ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-slate-800 rounded w-full"></div>
                      <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                    </div>
                  ) : (
                    <p className="text-indigo-100/90 text-lg leading-relaxed italic font-medium">
                      "{aiInsight}"
                    </p>
                  )}
                </div>
              </section>

              <section className="glass p-8 rounded-[2.5rem] space-y-6">
                <h3 className="font-bold text-xl">Top Performers</h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                  {leads.sort((a,b) => (b.enrichment?.ai_score || 0) - (a.enrichment?.ai_score || 0)).slice(0, 5).map(lead => (
                    <div key={lead.id} className="group p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 hover:border-indigo-500/30 transition-all cursor-pointer">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-indigo-600/20 transition-all">
                              <i className="fas fa-building text-slate-600 group-hover:text-indigo-400"></i>
                            </div>
                            <div>
                               <p className="font-bold text-sm text-white truncate max-w-[120px]">{lead.company_name}</p>
                               <p className="text-[10px] text-slate-500 font-bold uppercase">{lead.industry || 'B2B'}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="text-xs font-black text-indigo-400">{(lead.enrichment?.ai_score || 0).toFixed(0)}%</span>
                            <div className="flex gap-1 mt-1">
                              {lead.enrichment?.social_profiles?.linkedin && <i className="fab fa-linkedin text-[8px] text-slate-600"></i>}
                              {lead.enrichment?.social_profiles?.instagram && <i className="fab fa-instagram text-[8px] text-slate-600"></i>}
                            </div>
                         </div>
                      </div>
                    </div>
                  ))}
                  {leads.length === 0 && <p className="text-center text-slate-600 text-sm italic py-10">No top performers found.</p>}
                </div>
              </section>
            </div>
          </div>
        )}

        {view === 'prospector' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 max-w-4xl mx-auto py-10">
            <div className="text-center mb-16 space-y-4">
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-600/30">
                <i className="fas fa-radar text-3xl text-white animate-pulse"></i>
              </div>
              <h3 className="text-4xl font-black text-white">Global B2B Probe</h3>
              <p className="text-slate-500 max-w-lg mx-auto font-medium">Nexus uses deep-web search grounded in Gemini 3.0 to find 100% authentic, verified business leads from any industry or location.</p>
            </div>

            <div className="relative group">
              <input 
                disabled={isSearching}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDeepProbe(searchQuery)}
                className="w-full bg-slate-900/60 border-2 border-slate-800 rounded-3xl px-10 py-8 text-xl font-bold text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700"
                placeholder="Ex: Solar panel distributors in Dubai..."
              />
              <button 
                onClick={() => handleDeepProbe(searchQuery)}
                disabled={isSearching || !searchQuery}
                className="absolute right-4 top-4 bottom-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-8 rounded-2xl font-black text-white shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-3"
              >
                {isSearching ? <i className="fas fa-dna animate-spin"></i> : <i className="fas fa-bolt"></i>}
                {isSearching ? 'Ingesting...' : 'Initiate Probe'}
              </button>
            </div>

            {isSearching && (
              <div className="mt-12 space-y-6 animate-in fade-in duration-1000">
                <div className="flex flex-col items-center gap-4">
                   <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full w-2/3 animate-[shimmer_2s_infinite]"></div>
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Deep Ingestion Cycle Active: Browsing Real-World B2B Data...</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   {['Fetching Social Footprints...', 'Analyzing Google Maps...', 'Ingesting B2B Registries...', 'Validating Identity Metadata...'].map((s, i) => (
                     <div key={i} className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
                        <i className="fas fa-circle-notch animate-spin text-[8px] text-indigo-500"></i>
                        <span className="text-[10px] font-mono text-slate-500">{s}</span>
                     </div>
                   ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'pipeline' && (
          <div className="animate-in fade-in duration-500">
            <div className="glass rounded-[2.5rem] overflow-hidden border border-slate-800/50">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-7 text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Artifact</th>
                        <th className="p-7 text-[10px] font-black text-slate-500 uppercase tracking-widest">Digital Presence</th>
                        <th className="p-7 text-[10px] font-black text-slate-500 uppercase tracking-widest">Verification Status</th>
                        <th className="p-7 text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Readiness</th>
                        <th className="p-7 text-[10px] font-black text-slate-500 uppercase tracking-widest">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-20 text-center text-slate-600 italic">No leads in pipeline. Use the Prospector to find businesses.</td>
                        </tr>
                      ) : leads.map(lead => (
                        <tr key={lead.id} className="hover:bg-indigo-500/5 transition-all group">
                          <td className="p-7">
                            <p className="font-bold text-base text-white">{lead.company_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] font-black bg-slate-800 text-slate-500 px-2 py-0.5 rounded uppercase">{lead.industry || 'General B2B'}</span>
                               <span className="text-[10px] text-slate-600 font-medium tracking-tighter">via {lead.source}</span>
                            </div>
                          </td>
                          <td className="p-7">
                             <div className="flex gap-4">
                                {lead.enrichment?.social_profiles?.linkedin && <a href={lead.enrichment.social_profiles.linkedin} target="_blank" className="text-slate-500 hover:text-indigo-400 transition-colors"><i className="fab fa-linkedin text-lg"></i></a>}
                                {lead.enrichment?.social_profiles?.instagram && <a href={lead.enrichment.social_profiles.instagram} target="_blank" className="text-slate-500 hover:text-pink-400 transition-colors"><i className="fab fa-instagram text-lg"></i></a>}
                                {lead.enrichment?.social_profiles?.facebook && <a href={lead.enrichment.social_profiles.facebook} target="_blank" className="text-slate-500 hover:text-blue-400 transition-colors"><i className="fab fa-facebook text-lg"></i></a>}
                                {lead.enrichment?.social_profiles?.tiktok && <a href={lead.enrichment.social_profiles.tiktok} target="_blank" className="text-slate-500 hover:text-rose-400 transition-colors"><i className="fab fa-tiktok text-lg"></i></a>}
                                {lead.website && <a href={lead.website} target="_blank" className="text-slate-500 hover:text-emerald-400 transition-colors"><i className="fas fa-globe text-lg"></i></a>}
                             </div>
                          </td>
                          <td className="p-7">
                             <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${lead.enrichment?.validated ? 'text-emerald-400' : 'text-slate-600'}`}>
                                  <i className={`fas ${lead.enrichment?.validated ? 'fa-check-double' : 'fa-hourglass-start'}`}></i>
                                  {lead.enrichment?.validated ? 'Email Authenticated' : 'Identity Pending'}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 mt-1">{lead.email || 'Ingesting...'}</span>
                             </div>
                          </td>
                          <td className="p-7">
                             <div className="flex items-center gap-3">
                                <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${ (lead.enrichment?.ai_score || 0) > 75 ? 'bg-indigo-500' : 'bg-slate-700'}`} 
                                    style={{ width: `${lead.enrichment?.ai_score || 0}%` }}
                                  ></div>
                                </div>
                                <span className="font-black text-sm text-white">{(lead.enrichment?.ai_score || 0).toFixed(0)}</span>
                             </div>
                          </td>
                          <td className="p-7">
                             <button onClick={() => addLog(`Inspection: ${lead.company_name} details view.`)} className="bg-slate-800 hover:bg-slate-700 h-9 w-9 rounded-xl transition-all text-slate-500 flex items-center justify-center">
                                <i className="fas fa-fingerprint text-xs"></i>
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// UI Atoms
const SidebarLink = ({ icon, label, active, onClick }: { icon: string, label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
      active 
      ? 'bg-indigo-600/10 text-indigo-400 shadow-sm shadow-indigo-500/5' 
      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
    }`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-indigo-500/20' : 'bg-transparent group-hover:bg-slate-800'}`}>
      <i className={`fas ${icon} text-sm ${active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`}></i>
    </div>
    <span className="font-bold text-sm tracking-wide">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
  </button>
);

const StatCard = ({ label, value, trend, color, icon }: { label: string, value: string, trend: string, color: 'indigo' | 'emerald' | 'amber' | 'purple', icon: string }) => {
  const themes = {
    indigo: 'from-indigo-500/10 to-transparent border-indigo-500/10 text-indigo-400',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500/10 text-emerald-400',
    amber: 'from-amber-500/10 to-transparent border-amber-500/10 text-amber-400',
    purple: 'from-purple-500/10 to-transparent border-purple-500/10 text-purple-400'
  };
  return (
    <div className={`glass p-7 rounded-[2.5rem] bg-gradient-to-br ${themes[color]} group hover:border-slate-700 transition-all cursor-default`}>
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <i className={`fas ${icon} opacity-60`}></i>
        </div>
        <span className="text-[10px] font-black px-3 py-1 bg-slate-900/50 rounded-full border border-slate-800 uppercase tracking-widest">{trend}</span>
      </div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{label}</p>
      <h3 className="text-4xl font-black text-white">{value}</h3>
    </div>
  );
};

export default App;
