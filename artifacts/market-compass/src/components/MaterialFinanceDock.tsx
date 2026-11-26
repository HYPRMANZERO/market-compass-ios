import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import {Compass, Activity, CircleHelp, Menu} from 'lucide-react';

type Props={path:string;pending:number;menuOpen:boolean;navigate:(path:string)=>void;openMenu:()=>void};
const tabs=[
 {href:'/',label:'Home',accessible:'Overview',test:'home',Icon:Compass},
 {href:'/markets',label:'Markets',accessible:'Markets',test:'markets',Icon:Activity},
 {href:'/assistant',label:'AI',accessible:'Local assistant',test:'assistant',Icon:CircleHelp},
 {href:'menu',label:'Menu',accessible:'Open Market Compass menu',test:'menu',Icon:Menu},
] as const;
export default function MaterialFinanceDock({path,pending,menuOpen,navigate,openMenu}:Props){
 const value=menuOpen||!['/','/markets','/assistant'].includes(path)?'menu':path;
 return <BottomNavigation data-testid="finance-material-dock" aria-label="Finance Material UI navigation"
  className="fin-dock" showLabels value={value}
  onChange={(_,next:string)=>next==='menu'?openMenu():navigate(next)}
  sx={{backgroundColor:'transparent',height:'auto',display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'4px',
   '& .MuiBottomNavigationAction-root':{minWidth:0,maxWidth:'none',minHeight:52,padding:'4px 2px',borderRadius:'16px',
    color:'var(--fin-ink-soft)',fontFamily:'inherit',position:'relative',transition:'background-color 120ms ease',
    '&.Mui-selected':{color:'hsl(var(--primary))',backgroundColor:'hsl(var(--primary) / 0.10)'},
    '&:focus-visible':{outline:'2px solid hsl(var(--primary))',outlineOffset:'-3px'},
    '& .MuiBottomNavigationAction-label':{fontFamily:'inherit',fontSize:'11px',fontWeight:700,opacity:1,transform:'none'},
    '& .MuiBottomNavigationAction-label.Mui-selected':{fontSize:'11px'}}}}>
  {tabs.map(({href,label,accessible,test,Icon})=><BottomNavigationAction
    key={href} value={href} label={label} aria-label={accessible} aria-current={href===path?'page':undefined}
    aria-expanded={href==='menu'?menuOpen:undefined} data-menu={href==='menu'?'true':undefined}
    data-testid={'mobile-nav-'+test} disableRipple
    icon={<span style={{position:'relative',display:'inline-flex'}}><Icon size={21} strokeWidth={href===value?2.3:1.9} aria-hidden="true"/>
    {href==='menu'&&pending>0&&<span className="fin-tab-badge">{pending>99?'99+':pending}</span>}</span>}/>)}
 </BottomNavigation>;
}
