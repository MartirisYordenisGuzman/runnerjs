import { ThemeRegistry } from '../ThemeRegistry';
import { draculaTheme } from './dracula';
import { monokaiTheme } from './monokai';
import { oneDarkTheme } from './one-dark';
import { synthwave84Theme } from './synthwave84';
import { shadesOfPurpleTheme } from './shades-of-purple';
import { lightTheme } from './light';
import { nightOwlTheme } from './night-owl';
import { nordTheme } from './nord';
import { githubDarkTheme } from './github-dark';
import { palenightTheme } from './palenight';
import { gruvboxTheme } from './gruvbox';


export const registerDefaultThemes = () => {
  ThemeRegistry.registerTheme(draculaTheme);
  ThemeRegistry.registerTheme(monokaiTheme);
  ThemeRegistry.registerTheme(oneDarkTheme);
  ThemeRegistry.registerTheme(synthwave84Theme);
  ThemeRegistry.registerTheme(shadesOfPurpleTheme);
  ThemeRegistry.registerTheme(lightTheme);
  ThemeRegistry.registerTheme(nightOwlTheme);
  ThemeRegistry.registerTheme(nordTheme);
  ThemeRegistry.registerTheme(githubDarkTheme);
  ThemeRegistry.registerTheme(palenightTheme);
  ThemeRegistry.registerTheme(gruvboxTheme);

  
  // Also register a basic 'Dark' theme to match our current UI
  ThemeRegistry.registerTheme({
    name: 'Dark',
    type: 'dark',
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#ededed',
      'sideBar.background': '#111111',
      'sideBar.foreground': '#ededed',
      'titleBar.activeBackground': '#111111',
      'focusBorder': '#333333',
      'activityBarBadge.background': '#3b82f6',
      'button.background': '#333333'
    }
  });
};
