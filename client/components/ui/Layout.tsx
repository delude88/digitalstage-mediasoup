import Container from "./Container";
import CenteredCard from "./CenteredCard";
import {styled} from "baseui";
import React from "react";
import NavBar from "../NavBar";

const MarginTop = styled("div", {
    marginTop: '10vh'
});

export default (props: {
    children: React.ReactNode
}) => {
    return (
        <>
            <NavBar/>
            <Container>
                <MarginTop>
                    <CenteredCard>
                        {props.children}
                    </CenteredCard>
                </MarginTop>
            </Container>
        </>
    );
}
