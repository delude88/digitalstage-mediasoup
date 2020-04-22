export default interface Stage {
    id: string;
    name: string;
    //actors: Actor[];
    //director: Director;
    communication: 'p2p' | 'server';
    type: 'theater' | 'music' | 'conference'
}
