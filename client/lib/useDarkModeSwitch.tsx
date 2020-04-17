import React from "react";

export interface DarkModeProps {
    darkMode: boolean,

    setDarkMode: (enabled: boolean) => void
}

export const DarkModeContext = React.createContext<DarkModeProps>(undefined);

export const useDarkModeSwitch = () => React.useContext(DarkModeContext);


export const withDarkMode = (Component) => {
    const WithDarkMode = (props) => {
        const {darkMode, setDarkMode} = useDarkModeSwitch();
        return (
            <Component darkMode={darkMode} setDarkMode={setDarkMode} {...props} />
        )
    };
    return WithDarkMode;
};
