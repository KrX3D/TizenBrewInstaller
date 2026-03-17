import { render } from 'preact'
import './index.css'
import App from './app.jsx'
import { GlobalStateProvider } from './components/ClientContext.jsx'
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

init({ });
let lastBackAt = 0;

window.addEventListener('popstate', () => {
    if (window.location.pathname === '/ui/dist/index.html' || window.location.pathname === '/ui/dist/index.html/') {
        [40, 120, 260].forEach(delay => setTimeout(() => setFocus('home-card-install'), delay));
    }
});

window.addEventListener('keydown', (e) => {
    if (e.keyCode === 10009) {
        const now = Date.now();
        if (now - lastBackAt < 450) return;
        lastBackAt = now;

        e.preventDefault();
        e.stopPropagation();

        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.activeElement.blur();
            return;
        }

        if (location.pathname !== '/ui/dist/index.html' && location.pathname !== '/ui/dist/index.html/') {
            window.location.replace('/ui/dist/index.html');
        } else {
            tizen.application.getCurrentApplication().exit();
        }
    }
}, true);

// Register colour buttons so the TV routes them to the app
try {
    tizen.tvinputdevice.registerKey('ColorF1Green');   // keyCode 404 — used in ManageModules
    tizen.tvinputdevice.registerKey('ColorF0Red');     // 403
    tizen.tvinputdevice.registerKey('ColorF2Yellow');  // 405
    tizen.tvinputdevice.registerKey('ColorF3Blue');    // 406
} catch (_) {}

render(<GlobalStateProvider><App /></GlobalStateProvider>, document.getElementById('app'));