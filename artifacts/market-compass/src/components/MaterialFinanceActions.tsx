import Button from '@mui/material/Button';
import {Plus,Upload} from 'lucide-react';
const shared={minHeight:48,borderRadius:'14px',fontFamily:'inherit',fontSize:'13px',fontWeight:700,textTransform:'none' as const,
 lineHeight:1.25,padding:'10px 8px',boxShadow:'none','&:focus-visible':{outline:'2px solid hsl(var(--primary))',outlineOffset:2}};
export default function MaterialFinanceActions({onAdd,onImport}:{onAdd:()=>void;onImport:()=>void}){
 return <div className="fin-sheet-actions" data-testid="finance-material-actions">
  <Button type="button" variant="contained" disableRipple disableElevation startIcon={<Plus size={18}/>} onClick={onAdd}
   sx={{...shared,backgroundColor:'hsl(var(--primary))',color:'hsl(var(--primary-foreground))','&:hover':{backgroundColor:'hsl(var(--primary))'}}}>Add account</Button>
  <Button type="button" variant="outlined" disableRipple startIcon={<Upload size={18}/>} onClick={onImport}
   sx={{...shared,borderColor:'hsl(var(--border))',color:'hsl(var(--foreground))','&:hover':{borderColor:'hsl(var(--primary))'}}}>Import document</Button>
 </div>;
}
