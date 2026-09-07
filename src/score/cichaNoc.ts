import cichaNocXml from '../../cicha-noc.musicxml?raw';
import { parseScore } from './parseScore';

export const cichaNocScore = parseScore(cichaNocXml);
