import beyerNo08Xml from '../../beyer_op101_musicxml/beyer_op101_no08.musicxml?raw';
import beyerNo09Xml from '../../beyer_op101_musicxml/beyer_op101_no09.musicxml?raw';
import beyerNo12Xml from '../../beyer_op101_musicxml/beyer_op101_no12.musicxml?raw';
import beyerNo13Xml from '../../beyer_op101_musicxml/beyer_op101_no13.musicxml?raw';
import beyerNo14Xml from '../../beyer_op101_musicxml/beyer_op101_no14.musicxml?raw';
import beyerNo15Xml from '../../beyer_op101_musicxml/beyer_op101_no15.musicxml?raw';
import beyerNo16Xml from '../../beyer_op101_musicxml/beyer_op101_no16.musicxml?raw';
import beyerNo17Xml from '../../beyer_op101_musicxml/beyer_op101_no17.musicxml?raw';
import beyerNo18Xml from '../../beyer_op101_musicxml/beyer_op101_no18.musicxml?raw';
import beyerNo19Xml from '../../beyer_op101_musicxml/beyer_op101_no19.musicxml?raw';
import beyerNo20Xml from '../../beyer_op101_musicxml/beyer_op101_no20.musicxml?raw';
import beyerNo21Xml from '../../beyer_op101_musicxml/beyer_op101_no21.musicxml?raw';
import beyerNo22Xml from '../../beyer_op101_musicxml/beyer_op101_no22.musicxml?raw';
import beyerNo23Xml from '../../beyer_op101_musicxml/beyer_op101_no23.musicxml?raw';
import beyerNo24Xml from '../../beyer_op101_musicxml/beyer_op101_no24.musicxml?raw';
import beyerNo25Xml from '../../beyer_op101_musicxml/beyer_op101_no25.musicxml?raw';
import beyerNo26Xml from '../../beyer_op101_musicxml/beyer_op101_no26.musicxml?raw';
import beyerNo27Xml from '../../beyer_op101_musicxml/beyer_op101_no27.musicxml?raw';
import beyerNo28Xml from '../../beyer_op101_musicxml/beyer_op101_no28.musicxml?raw';
import beyerNo29Xml from '../../beyer_op101_musicxml/beyer_op101_no29.musicxml?raw';
import beyerNo30Xml from '../../beyer_op101_musicxml/beyer_op101_no30.musicxml?raw';
import beyerNo31Xml from '../../beyer_op101_musicxml/beyer_op101_no31.musicxml?raw';
import { cichaNocScore, cichaNocXml } from './cichaNoc';
import { parseScore } from './parseScore';
import type { Score } from './types';

export interface Piece {
  /** Stored in the history, so it names this piece for good; the file and title may change. */
  id: string;
  xml: string;
  score: Score;
  /** An upload's title, which may come from its file name; a bundled piece's is its score's. */
  title: string;
}

function piece(id: string, xml: string): Piece {
  const score = parseScore(xml);
  return { id, xml, score, title: score.title };
}

/**
 * The pieces the player can choose, in the order the dropdown lists them. A file in
 * beyer_op101_musicxml/ reaches the child only by a line here — see DECISIONS.md, which
 * also says why Nos. 10, 11 and 38 are not offered.
 */
export const PIECES: readonly Piece[] = [
  { id: 'cicha-noc', xml: cichaNocXml, score: cichaNocScore, title: cichaNocScore.title },
  piece('beyer-op101-08', beyerNo08Xml),
  piece('beyer-op101-09', beyerNo09Xml),
  piece('beyer-op101-12', beyerNo12Xml),
  piece('beyer-op101-13', beyerNo13Xml),
  piece('beyer-op101-14', beyerNo14Xml),
  piece('beyer-op101-15', beyerNo15Xml),
  piece('beyer-op101-16', beyerNo16Xml),
  piece('beyer-op101-17', beyerNo17Xml),
  piece('beyer-op101-18', beyerNo18Xml),
  piece('beyer-op101-19', beyerNo19Xml),
  piece('beyer-op101-20', beyerNo20Xml),
  piece('beyer-op101-21', beyerNo21Xml),
  piece('beyer-op101-22', beyerNo22Xml),
  piece('beyer-op101-23', beyerNo23Xml),
  piece('beyer-op101-24', beyerNo24Xml),
  piece('beyer-op101-25', beyerNo25Xml),
  piece('beyer-op101-26', beyerNo26Xml),
  piece('beyer-op101-27', beyerNo27Xml),
  piece('beyer-op101-28', beyerNo28Xml),
  piece('beyer-op101-29', beyerNo29Xml),
  piece('beyer-op101-30', beyerNo30Xml),
  piece('beyer-op101-31', beyerNo31Xml),
];

/** The title of the piece in `pieces` with this id, or the id itself for one not offered. */
export function pieceTitle(id: string, pieces: readonly Piece[]): string {
  return pieces.find((candidate) => candidate.id === id)?.title ?? id;
}
