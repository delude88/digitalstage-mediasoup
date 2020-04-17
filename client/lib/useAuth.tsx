import initFirebase from "./initFirebase";
import React, {useEffect, useState} from "react";
import firebase from "firebase/app";
import "firebase/auth";
import nextCookie from 'next-cookies';
import cookie from 'js-cookie';

initFirebase();

export interface AuthProps {
    user: firebase.User | null;
    loading: boolean;
}

const AuthContext = React.createContext(undefined);
export const useAuthDep = (): AuthProps => {
    const [state, setState] = useState<AuthProps>(() => {
        const user = firebase.auth().currentUser;
        return {
            loading: !user,
            user
        };
    });

    function onChange(user: firebase.User | null) {
        console.log("Have a new onAuthStateChanged");
        setState({loading: false, user});

        if (user) {
            user.getIdToken().then(
                (token: string) => {
                    cookie.set('token', token, {expires: 1});
                }
            );
        } else {
            cookie.remove('token');
        }
    }

    useEffect(() => {
        // Listen for auth state changes.
        const unsubscribe = firebase.auth().onAuthStateChanged(onChange);

        // Unsubscribe to the listener when unmounting.
        return () => unsubscribe();
    }, []);

    return state;
};

export const useAuth = (): AuthProps => React.useContext<AuthProps>(AuthContext);

export const AuthContextProvider = (props: {
    children: React.ReactNode
}) => {
    const [state, setState] = useState<AuthProps>((): AuthProps => {
        const user = firebase.auth().currentUser;
        return {
            user: user,
            loading: !user
        };
    });

    const handleChange = (user: firebase.User | null) => {
        setState({
            user: user,
            loading: false
        });
        if (user) {
            user.getIdToken().then(
                (token: string) => {
                    cookie.set('token', token, {expires: 1});
                }
            );
        } else {
            cookie.remove('token');
        }
    };

    useEffect(() => {
        const unsubscribe: firebase.Unsubscribe = firebase.auth().onAuthStateChanged(handleChange);
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={state}>
            {props.children}
        </AuthContext.Provider>
    );
};

export const withAuth = (ComposedComponent: any) => {
    const DecoratedComponent = (props: any) => {
        return (
            <AuthContext.Consumer>
                {(auth: AuthProps) => (
                    <ComposedComponent auth={auth} {...props} />
                )}
            </AuthContext.Consumer>
        );
    };
    return DecoratedComponent;
};
