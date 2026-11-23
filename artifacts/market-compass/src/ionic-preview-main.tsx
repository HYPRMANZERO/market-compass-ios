import React from 'react';
import {createRoot} from 'react-dom/client';
import {setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import './ionic-preview.css';
import IonicPreviewApp from './IonicPreviewApp';

setupIonicReact({mode:'ios'});
const root=document.getElementById('ionic-preview-root');
if(!root)throw Error('Ionic preview root was not found');
createRoot(root).render(<React.StrictMode><IonicPreviewApp/></React.StrictMode>);
