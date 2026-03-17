import { render } from 'preact'
import './index.css'
import App from './app.jsx'
import { GlobalStateProvider } from './components/ClientContext.jsx'
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

init({ });

window.addEventListener('keydown', (e) => {
    if (e.keyCode === 13) {
        // preventDefault stops the TV from ALSO firing a synthetic click after
        // keydown, which would call every handler twice.
        e.preventDefault();
        document.querySelector('.focus')?.click();
    } else if (e.keyCode === 10009) {
        e.preventDefault();
        e.stopPropagation();

        // Close virtual keyboard first if an input is currently focused.
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.activeElement.blur();
            return;
        }

        if (location.pathname !== '/ui/dist/index.html' && location.pathname !== '/ui/dist/index.html/') {
            history.back();
            setFocus('sn:focusable-item-1');
        } else {
            tizen.application.getCurrentApplication().exit();
        }
    }
}, true);

render(<GlobalStateProvider><App /></GlobalStateProvider>, document.getElementById('app'));
