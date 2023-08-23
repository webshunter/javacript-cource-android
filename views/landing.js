
import { Sidebar, About } from './code.js';

const dataMenus = [
    {
        name: 'Home',
        link: '#home'
    }
    , {
        name: 'About Us',
        link: '#about'
    }
];

export const clearSession = function(){
    let screenRole = Array.from(document.querySelectorAll('body > div'));
    screenRole.forEach(function (role) {
        if (role.id != 'app') {
            role.remove();
        }
    });
    document.body.style.overflow = 'auto';
}

export const landing = function(){
// clear session
    clearSession();
// definition variable
    const sidebar = new Sidebar();
    let container = div();
    let contain = container.get()

// add component to container view
    contain.appendChild(sidebar.component);
    contain.appendChild(el('script').html(`
        hljs.highlightAll();
    `).get());
    
    return contain;
} 

export const about = function(){
// clear session
    clearSession();
// definition variable
    const sidebar = new About();
    let container = div();
    let contain = container.get()

// add component to container view
    contain.appendChild(sidebar.component);
    contain.appendChild(el('script').html(`
        hljs.highlightAll();
    `).get());
    return contain;
} 