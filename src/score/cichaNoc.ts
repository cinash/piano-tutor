import cichaNocXml from '../../cicha-noc.musicxml?raw';
import { parseScore } from './parseScore';

// The staff renders from the XML and the engine runs on the parsed score; they are two
// independent representations of the same piece, neither derived from the other — see
// DECISIONS.md.
export { cichaNocXml };
export const cichaNocScore = parseScore(cichaNocXml);
