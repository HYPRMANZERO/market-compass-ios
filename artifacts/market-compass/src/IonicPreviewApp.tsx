import {useState} from 'react';
import {
  IonActionSheet,IonApp,IonBadge,IonButton,IonCard,IonCardContent,
  IonCardHeader,IonCardTitle,IonChip,IonContent,IonFooter,IonHeader,
  IonItem,IonLabel,IonList,IonModal,IonPage,IonSegment,IonSegmentButton,
  IonTitle,IonToast,IonToolbar
} from '@ionic/react';

type View='accounts'|'spend'|'markets';
const accounts=[
  {id:'everyday',name:'Everyday account',type:'Cheque',balance:'R 12 480,25',identifier:'•••• 4831'},
  {id:'savings',name:'Savings pocket',type:'Savings',balance:'R 2 100,00',identifier:'•••• 1072'},
  {id:'credit',name:'Credit facility',type:'Credit',balance:'R 5 640,10 owed',identifier:'•••• 6915'}
];
const purchases=[
  {id:'food',name:'Groceries',total:'R 1 240,20',items:['Supermarket · R 740,20','Food store · R 500,00']},
  {id:'travel',name:'Transport',total:'R 845,00',items:['Fuel station · R 545,00','Taxi · R 300,00']},
  {id:'bills',name:'Subscriptions',total:'R 229,00',items:['Monthly plan · R 229,00']}
];
export default function IonicPreviewApp(){
  const [view,setView]=useState<View>('accounts');
  const [menuOpen,setMenuOpen]=useState(false);
  const [selectedAccount,setSelectedAccount]=useState<string|null>(null);
  const [expandedCategory,setExpandedCategory]=useState<string|null>(null);
  const [toast,setToast]=useState('');
  const selected=accounts.find(a=>a.id===selectedAccount);
  const demo=(label:string)=>setToast(label+' is a UI demonstration. No data was changed.');
  const actions=[
    {text:'＋  Add account (demo)',handler:()=>demo('Add account')},
    {text:'▤  Import document (demo)',handler:()=>demo('Import document')},
    {text:'✦  Ask Compass (demo)',handler:()=>demo('Ask Compass')},
    {text:'⌁  Markets',handler:()=>setView('markets')},
    {text:'⇄  Orders (demo)',handler:()=>demo('Orders')},
    {text:'Close',role:'cancel'}
  ];
  return <IonApp>
    <IonPage>
      <IonHeader translucent={false}>
        <IonToolbar>
          <IonTitle>Market Compass</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={()=>setMenuOpen(true)}
            aria-label="Open Ionic demo action sheet">☰</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={false}>
        <div className="ion-padding">
          <IonChip color="warning" className="ionic-chip">INTERACTIVE UI DEMO · SAMPLE DATA ONLY</IonChip>
          <h1 className="ionic-heading">Your financial space</h1>
          <p className="ionic-muted">Ionic components with Market Compass colours. Tap accounts, categories and the menu to compare the native-style interactions. Your real vault is not used.</p>
        </div>
        {view==='accounts'&&<>
          <section className="ionic-hero">
            <small>Sample available funds · not a bank balance</small>
            <strong>R 14 580,25</strong>
            <small>Private on-device app concept · account tiles below</small>
          </section>
          <div className="ion-padding-horizontal"><h2 className="ionic-heading">Accounts</h2></div>
          <IonList className="ionic-list">
            {accounts.map(a=><IonItem key={a.id} button detail onClick={()=>setSelectedAccount(a.id)}>
              <IonLabel><strong>{a.name}</strong><p>{a.type} · {a.identifier}</p></IonLabel>
              <IonBadge slot="end" color={a.id==='credit'?'warning':'success'}>{a.balance}</IonBadge>
            </IonItem>)}
          </IonList>
          <IonCard>
            <IonCardHeader><IonCardTitle>Quick actions</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <IonButton size="small" onClick={()=>setMenuOpen(true)}>Open menu</IonButton>
                <IonButton size="small" fill="outline" onClick={()=>setView('spend')}>See spending</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        </>}
        {view==='spend'&&<>
          <section className="ionic-hero">
            <small>Example salary cycle · 26 May – 25 June</small>
            <strong>R 2 314,20</strong>
            <small>Example spending · approved-transaction portfolio concept</small>
          </section>
          <div className="ion-padding-horizontal"><h2 className="ionic-heading">Purchases by category</h2>
            <p className="ionic-muted">Expand a category to inspect its sample transactions.</p>
          </div>
          <IonList className="ionic-list">
            {purchases.map(p=><div key={p.id}>
              <IonItem button detail={expandedCategory!==p.id}
                onClick={()=>setExpandedCategory(expandedCategory===p.id?null:p.id)}>
                <IonLabel><strong>{p.name}</strong></IonLabel><strong slot="end">{p.total}</strong>
              </IonItem>
              {expandedCategory===p.id&&p.items.map(row=><IonItem key={row} lines="inset">
                <IonLabel style={{fontSize:13,paddingLeft:12}}>{row}</IonLabel>
              </IonItem>)}
            </div>)}
          </IonList>
          <IonCard><IonCardContent><p className="ionic-muted">This preview does not import documents or change Spend. Your actual transactions stay in the original PWA's encrypted vault.</p></IonCardContent></IonCard>
        </>}
        {view==='markets'&&<>
          <div className="ion-padding"><h2 className="ionic-heading">Markets concept</h2>
            <p className="ionic-muted">A native-style list for future market research and order approvals, with no trading enabled in this demo.</p>
          </div>
          <IonList className="ionic-list">
            {['JSE market watch','Global indices','Crypto research','Order drafts'].map(title=><IonItem key={title} button detail onClick={()=>demo(title)}>
              <IonLabel>{title}</IonLabel></IonItem>)}
          </IonList>
        </>}
        <div style={{height:16}}/>
      </IonContent>
      <IonFooter>
        <div className="ionic-preview-tabs">
          <IonSegment value={view} onIonChange={event=>setView(event.detail.value as View)}>
            <IonSegmentButton value="accounts"><IonLabel>Accounts</IonLabel></IonSegmentButton>
            <IonSegmentButton value="spend"><IonLabel>Spend</IonLabel></IonSegmentButton>
            <IonSegmentButton value="markets"><IonLabel>Markets</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>
      </IonFooter>
      <IonActionSheet isOpen={menuOpen} header="Market Compass · Ionic action sheet"
        subHeader="Preview controls only — no real account changes"
        buttons={actions} onDidDismiss={()=>setMenuOpen(false)}/>
      <IonModal isOpen={Boolean(selected)} onDidDismiss={()=>setSelectedAccount(null)}>
        <IonHeader><IonToolbar><IonTitle>{selected?.name??'Account'}</IonTitle>
          <IonButton slot="end" fill="clear" onClick={()=>setSelectedAccount(null)}>Close</IonButton>
        </IonToolbar></IonHeader>
        <IonContent className="ion-padding">
          <h2 className="ionic-heading">{selected?.balance}</h2>
          <p className="ionic-muted">Sample {selected?.type.toLowerCase()} account · {selected?.identifier}. Account details and transactions would appear here.</p>
          <IonCard><IonCardHeader><IonCardTitle>Account details</IonCardTitle></IonCardHeader>
            <IonCardContent>Transaction history, linked documents and monthly cycle totals can use this Ionic-style drilldown.</IonCardContent>
          </IonCard>
          <IonButton expand="block" onClick={()=>{setSelectedAccount(null);setView('spend');}}>Explore spend preview</IonButton>
        </IonContent>
      </IonModal>
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2600}
        onDidDismiss={()=>setToast('')}/>
    </IonPage>
  </IonApp>;
}
