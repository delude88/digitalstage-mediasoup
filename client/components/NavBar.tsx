import {ALIGN, HeaderNavigation, StyledNavigationItem, StyledNavigationList} from "baseui/header-navigation";
import React from "react";
import {Button} from "baseui/button";
import {useAuth} from "../lib/useAuth";
import Link from "next/link";
import {styled} from "baseui";

const NavContainer = styled("div", {
    width: '100%'
});

const CenterVertical = styled("div", {
    display: 'flex',
    alignItems: 'center'
});

const Banner = styled("img", {
    width: '40px',
    paddingRight: '1rem'
});

export default () => {
    const {user, loading} = useAuth();

    return (
        <NavContainer>
            <HeaderNavigation>
                <StyledNavigationList $align={ALIGN.left}>
                    <StyledNavigationItem>
                        <CenterVertical>
                            <Banner src={"/logo.png"}/>
                            Digital Stage
                        </CenterVertical>
                    </StyledNavigationItem>
                </StyledNavigationList>
                <StyledNavigationList $align={ALIGN.center}/>
                <StyledNavigationList $align={ALIGN.right}>
                    {!user ? (
                        <>
                            <StyledNavigationItem>
                                <Link href="/stage/signup">
                                    <Button isLoading={loading}>Sign Up</Button>
                                </Link>
                            </StyledNavigationItem>
                            <StyledNavigationItem>
                                <Link href="/stage/login">
                                    <Button isLoading={loading}>Login</Button>
                                </Link>
                            </StyledNavigationItem>
                        </>
                    ) : (
                        <>
                            <StyledNavigationItem>
                                <Link href="/stage">
                                    Enter stage
                                </Link>
                            </StyledNavigationItem>
                            <StyledNavigationItem>
                                <Link href="/stage/account">
                                    Account
                                </Link>
                            </StyledNavigationItem>
                            <StyledNavigationItem>
                                <Link href="/stage/logout">
                                    <Button isLoading={loading}>Logout</Button>
                                </Link>
                            </StyledNavigationItem>
                        </>
                    )}
                </StyledNavigationList>
            </HeaderNavigation>
        </NavContainer>
    );
};
