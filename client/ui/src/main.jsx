import { render } from 'preact'
import './index.css'
import App from './app.jsx'
import { GlobalStateProvider } from './components/ClientContext.jsx'
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

init({ });
let lastBackAt = 0;

function restoreHomeFocus() {
    // Retry a few times because route transitions/layout can lag on some TVs.
    [40, 120, 260].forEach(delay => setTimeout(() => setFocus('home-card-install'), delay));
}

window.addEventListener('popstate', () => {
    if (window.location.pathname === '/ui/dist/index.html' || window.location.pathname === '/ui/dist/index.html/') {
        restoreHomeFocus();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.keyCode === 10009) {
        const now = Date.now();
        if (now - lastBackAt < 450) return;
        lastBackAt = now;

        e.preventDefault();
        e.stopPropagation();

        // Close virtual keyboard first if an input is currently focused.
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.activeElement.blur();
            return;
        }

        if (location.pathname !== '/ui/dist/index.html' && location.pathname !== '/ui/dist/index.html/') {
            // On some older Tizen versions, history.back() updates history but UI can stay stale.
            // Route directly to home for consistent behavior across TV versions.
            window.location.replace('/ui/dist/index.html');
        } else {
            tizen.application.getCurrentApplication().exit();
        }
    }
}, true);

render(<GlobalStateProvider><App /></GlobalStateProvider>, document.getElementById('app'));
