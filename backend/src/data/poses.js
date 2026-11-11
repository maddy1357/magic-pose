'use strict';
/*
 * The pose library shown in Explore and used by Idea and Template modes.
 * Each figure is a spec for lib/skeleton.js (angles in degrees, 0 = down,
 * 90 = screen-right, 180 = up; "l"/"r" = screen left/right).
 */

const CATEGORIES = [
  { id: 'standing', name: 'Standing', emoji: '🧍' },
  { id: 'fashion', name: 'Fashion', emoji: '👗' },
  { id: 'sitting', name: 'Sitting', emoji: '🪑' },
  { id: 'selfie', name: 'Selfie', emoji: '🤳' },
  { id: 'fun', name: 'Fun', emoji: '🤸' },
  { id: 'fitness', name: 'Fitness', emoji: '🧘' },
  { id: 'couple', name: 'Couple', emoji: '💑' },
  { id: 'group', name: 'Group', emoji: '👨‍👩‍👧' },
];

// Reusable arm and leg shapes
const HANDS_ON_HIPS = { lArm: [-35, 45], rArm: [35, -45] };
const ARMS_CROSSED = { lArm: [5, 80, 0.75], rArm: [-5, -80, 0.75] };
const POCKETS = { lArm: [-10, 25, 1, 0.5], rArm: [10, -25, 1, 0.5] };
const SELFIE_ARM = [70, 60]; // screen-right arm reaching out of frame, holding the phone

const POSES = [
  // ---------------------------------------------------------------- Standing
  {
    id: 'hands-on-hips', name: 'Hands on Hips', category: 'standing', difficulty: 'Easy',
    description: 'A confident, open stance with both hands resting on the hips.',
    tips: ['Stand with feet hip-width apart', 'Push the elbows slightly back', 'Lift your chin a little'],
    figures: [{ ...HANDS_ON_HIPS, lLeg: [-8, -4], rLeg: [8, 4] }],
  },
  {
    id: 'arms-crossed', name: 'Arms Crossed', category: 'standing', difficulty: 'Easy',
    description: 'Classic professional pose with folded arms — great for profile photos.',
    tips: ['Relax your shoulders', 'Keep the arms loose, not squeezed', 'Smile with your eyes'],
    figures: [{ ...ARMS_CROSSED, lLeg: [-6, -3], rLeg: [6, 3] }],
  },
  {
    id: 'relaxed-pockets', name: 'Relaxed Pockets', category: 'standing', difficulty: 'Easy',
    description: 'Hands in pockets with your weight on one leg for a casual look.',
    tips: ['Put only your fingers in the pockets', 'Shift your weight to one leg', 'Tilt your head slightly'],
    figures: [{ ...POCKETS, torso: 177, head: 174, lLeg: [-6, -1], rLeg: [10, 2] }],
  },
  {
    id: 'the-wave', name: 'The Wave', category: 'standing', difficulty: 'Easy',
    description: 'A friendly wave — perfect for travel and holiday shots.',
    tips: ['Open your palm towards the camera', 'Keep the other arm relaxed', 'Big smile!'],
    figures: [{ lArm: [-8, -4], rArm: [110, 175] }],
  },
  {
    id: 'thinker', name: 'The Thinker', category: 'standing', difficulty: 'Medium',
    description: 'One hand at the chin, the other arm supporting the elbow.',
    tips: ['Rest your knuckles lightly at your chin', 'Look slightly away from the lens', 'Keep your back straight'],
    figures: [{ head: 175, lArm: [15, 80, 0.7, 0.9], rArm: [10, -152, 0.6] }],
  },
  {
    id: 'leaning-cross', name: 'Lean & Cross', category: 'standing', difficulty: 'Medium',
    description: 'Lean against a wall with your ankles crossed.',
    tips: ['Lean your shoulder on a wall', 'Cross the front ankle over', 'Hands in pockets or holding a coffee'],
    figures: [{ ...POCKETS, torso: 174, head: 176, hip: [52, 88], lLeg: [8, 12], rLeg: [-2, -2] }],
  },
  {
    id: 'victory', name: 'Victory', category: 'standing', difficulty: 'Easy',
    description: 'Both arms raised high in a V — celebrate the moment!',
    tips: ['Reach high and wide', 'Open your hands or make fists', 'Shoot from a low angle'],
    figures: [{ lArm: [-150, -160], rArm: [150, 160], lLeg: [-12, -8], rLeg: [12, 8] }],
  },
  {
    id: 'hair-touch', name: 'Hand in Hair', category: 'standing', difficulty: 'Medium',
    description: 'One hand resting on top of your head with a relaxed hip sway.',
    tips: ['Touch your hair lightly', 'Pop one hip to the side', 'Close your eyes or look up'],
    figures: [{ torso: 176, head: 172, lArm: [-12, -6], rArm: [150, -110], lLeg: [-2, 0], rLeg: [10, 4] }],
  },

  // ----------------------------------------------------------------- Fashion
  {
    id: 'editorial-hip', name: 'Editorial Hip', category: 'fashion', difficulty: 'Medium',
    description: 'A runway-ready lean with one hand on the hip and crossed legs.',
    tips: ['Lean your upper body away from the hand on the hip', 'Cross one leg in front', 'Serious face, strong eyes'],
    figures: [{ torso: 172, head: 186, hip: [48, 88], lArm: [-6, -2], rArm: [35, -45], lLeg: [4, 8], rLeg: [6, 2] }],
  },
  {
    id: 'power-stance', name: 'Power Stance', category: 'fashion', difficulty: 'Easy',
    description: 'Feet wide, hands on hips — the hero shot.',
    tips: ['Plant your feet wider than your shoulders', 'Chest out, chin up', 'Shoot from slightly below'],
    figures: [{ ...HANDS_ON_HIPS, lLeg: [-14, -10], rLeg: [14, 10] }],
  },
  {
    id: 'jacket-shoulder', name: 'Jacket Over Shoulder', category: 'fashion', difficulty: 'Medium',
    description: 'Hold a jacket over your shoulder with the other hand in a pocket.',
    tips: ['Hook the jacket on two fingers', 'Keep the other hand relaxed in a pocket', 'Turn slightly to the side'],
    figures: [{ head: 176, lArm: [-10, 25, 1, 0.5], rArm: [170, -15, 1, 1], lLeg: [-4, -2], rLeg: [8, 3] }],
  },
  {
    id: 'runway-walk', name: 'Runway Walk', category: 'fashion', difficulty: 'Medium',
    description: 'Walking towards the camera, one foot crossing in front of the other.',
    tips: ['Walk slowly and take many shots', 'Place one foot in front of the other', 'Let your arms swing naturally'],
    figures: [{ torso: 178, lArm: [-14, -6], rArm: [8, 14], lLeg: [3, 4], rLeg: [-3, -6, 0.95, 0.95] }],
  },
  {
    id: 'sunglasses', name: 'Sunglasses Touch', category: 'fashion', difficulty: 'Easy',
    description: 'Adjust your sunglasses with one hand — effortlessly cool.',
    tips: ['Hold the frame with two fingers', 'Look over the top of the glasses', 'Keep the other arm loose'],
    figures: [{ head: 177, lArm: [-10, -4], rArm: [15, -160, 0.55] }],
  },

  // ----------------------------------------------------------------- Sitting
  {
    id: 'chair-relaxed', name: 'Relaxed Chair', category: 'sitting', difficulty: 'Easy',
    description: 'Sit upright on a chair with your hands resting on your lap.',
    tips: ['Sit near the front of the chair', 'Keep your back long', 'Rest your hands softly'],
    figures: [{ hip: [50, 100], lArm: [-5, 30, 1, 0.8], rArm: [5, -30, 1, 0.8], lLeg: [-8, 0, 0.35, 1], rLeg: [8, 0, 0.35, 1] }],
  },
  {
    id: 'cross-legged', name: 'Cross-Legged', category: 'sitting', difficulty: 'Easy',
    description: 'Sit on the floor with crossed legs and hands on your knees.',
    tips: ['Sit tall', 'Rest your hands on your knees', 'Great for picnics and beaches'],
    figures: [{ hip: [50, 118], lArm: [-20, -35], rArm: [20, 35], lLeg: [-75, 75, 0.9, 1], rLeg: [75, -75, 0.9, 1] }],
  },
  {
    id: 'one-knee-up', name: 'One Knee Up', category: 'sitting', difficulty: 'Easy',
    description: 'Sit on the floor with one knee raised and an arm resting on it.',
    tips: ['Rest your wrist loosely on the knee', 'Lean back on the other hand', 'Lovely on grass, sand or steps'],
    figures: [{ hip: [50, 118], head: 175, lArm: [-30, -10, 1, 0.7], rArm: [30, 20], lLeg: [-130, 10, 0.7, 1], rLeg: [70, -80, 0.9, 0.9] }],
  },
  {
    id: 'seated-chin', name: 'Seated Chin Rest', category: 'sitting', difficulty: 'Medium',
    description: 'Sitting with your chin resting on one hand — thoughtful and calm.',
    tips: ['Lean forward slightly', 'Rest your elbow on your knee or a table', 'Look past the camera'],
    figures: [{ hip: [50, 100], head: 175, lArm: [-5, 30, 1, 0.8], rArm: [0, -170, 0.55, 0.9], lLeg: [-8, 0, 0.35, 1], rLeg: [8, 0, 0.35, 1] }],
  },
  {
    id: 'steps-casual', name: 'Steps Casual', category: 'sitting', difficulty: 'Easy',
    description: 'Sit on a step with your knees apart and forearms resting on them.',
    tips: ['Sit one step up from the camera', 'Rest your forearms on your knees', 'Lean forward a little'],
    figures: [{ hip: [50, 118], lArm: [-15, 30, 1, 0.8], rArm: [15, -30, 1, 0.8], lLeg: [-130, 0, 0.55, 1], rLeg: [130, 0, 0.55, 1] }],
  },

  // ------------------------------------------------------------------ Selfie
  {
    id: 'classic-selfie', name: 'Classic Selfie', category: 'selfie', difficulty: 'Easy', framing: 'half',
    description: 'Phone held high and slightly to the side, head tilted.',
    tips: ['Hold the phone just above eye level', 'Tilt your head a little', 'Find soft window light'],
    figures: [{ head: 172, lArm: [-8, -4], rArm: SELFIE_ARM }],
  },
  {
    id: 'peace-selfie', name: 'Peace Sign', category: 'selfie', difficulty: 'Easy', framing: 'half',
    description: 'The timeless peace sign next to your face.',
    tips: ['Keep the hand close to your cheek', 'Wink or smile big', 'Fingers slightly apart'],
    figures: [{ head: 186, lArm: [-30, 169, 0.8], rArm: SELFIE_ARM }],
  },
  {
    id: 'chin-selfie', name: 'Chin on Hand', category: 'selfie', difficulty: 'Easy', framing: 'half',
    description: 'Rest your chin on your hand for a soft, dreamy selfie.',
    tips: ['Barely touch your chin', 'Look into the lens', 'Relax your mouth'],
    figures: [{ head: 186, lArm: [-10, 152, 0.6], rArm: SELFIE_ARM }],
  },
  {
    id: 'heart-hands', name: 'Heart Hands', category: 'selfie', difficulty: 'Easy', framing: 'half',
    description: 'Make a heart with both hands under your chin. Use the timer!',
    tips: ['Turn on the 3 s timer', 'Hold the heart close to your chin', 'Smile!'],
    figures: [{ lArm: [-10, 118, 0.6, 0.8], rArm: [10, -118, 0.6, 0.8] }],
  },

  // -------------------------------------------------------------------- Fun
  {
    id: 'star-jump', name: 'Star Jump', category: 'fun', difficulty: 'Medium',
    description: 'Jump with arms and legs spread wide like a star.',
    tips: ['Use burst mode or a short timer', 'Jump on "three!"', 'Shoot from low down to look higher'],
    figures: [{ hip: [50, 80], lArm: [-140, -145], rArm: [140, 145], lLeg: [-30, -35], rLeg: [30, 35] }],
  },
  {
    id: 'double-flex', name: 'Double Flex', category: 'fun', difficulty: 'Easy',
    description: 'Show off both biceps — strong and playful.',
    tips: ['Make fists', 'Squeeze and smile', 'Feet shoulder-width apart'],
    figures: [{ lArm: [-90, 180], rArm: [90, 180], lLeg: [-8, -4], rLeg: [8, 4] }],
  },
  {
    id: 'air-kick', name: 'Air Kick', category: 'fun', difficulty: 'Hard',
    description: 'A high kick to the side with arms out for balance.',
    tips: ['Warm up first!', 'Kick and hold for a second', 'Use the timer and multiple tries'],
    figures: [{ hip: [52, 84], torso: 172, lArm: [-100, -110], rArm: [60, 30], lLeg: [-60, -55], rLeg: [4, 2] }],
  },
  {
    id: 'dab', name: 'The Dab', category: 'fun', difficulty: 'Easy',
    description: 'One arm stretched up, face tucked into the other elbow.',
    tips: ['Both arms point the same way', 'Hide your face in the elbow', 'Do it fast and with energy'],
    figures: [{ head: 205, lArm: [-125, -125], rArm: [-125, -150], lLeg: [-8, -4], rLeg: [8, 4] }],
  },
  {
    id: 'sky-point', name: 'Point to the Sky', category: 'fun', difficulty: 'Easy',
    description: 'Point up at something amazing — a building, a plane or the stars.',
    tips: ['Look where you are pointing', 'Shoot from below', 'Great with tall landmarks'],
    figures: [{ head: 172, lArm: [-15, 40, 1, 0.7], rArm: [160, 165], lLeg: [-6, -3], rLeg: [6, 3] }],
  },

  // ---------------------------------------------------------------- Fitness
  {
    id: 'warrior-two', name: 'Warrior II', category: 'fitness', difficulty: 'Medium',
    description: 'Yoga warrior: wide stance, front knee bent, arms stretched out.',
    tips: ['Bend the front knee over the ankle', 'Stretch the arms in one line', 'Look over the front hand'],
    figures: [{ hip: [50, 100], lArm: [-90, -90], rArm: [90, 90], lLeg: [-50, -5], rLeg: [55, 60] }],
  },
  {
    id: 'tree-pose', name: 'Tree Pose', category: 'fitness', difficulty: 'Medium',
    description: 'Balance on one leg, foot on the inner thigh, hands together overhead.',
    tips: ['Fix your eyes on one point', 'Press the foot into the thigh', 'Breathe slowly'],
    figures: [{ lArm: [-165, 125], rArm: [165, -125], lLeg: [5, 0], rLeg: [40, -92, 0.9, 1] }],
  },
  {
    id: 'goddess-squat', name: 'Goddess Squat', category: 'fitness', difficulty: 'Medium',
    description: 'A wide squat with knees out and hands pressed together at the chest.',
    tips: ['Point toes outwards', 'Sink the hips low', 'Keep the chest lifted'],
    figures: [{ hip: [50, 112], lArm: [-10, 118, 0.6, 0.8], rArm: [10, -118, 0.6, 0.8], lLeg: [-50, 5], rLeg: [50, -5] }],
  },

  // ----------------------------------------------------------------- Couple
  {
    id: 'holding-hands', name: 'Holding Hands', category: 'couple', difficulty: 'Easy',
    description: 'Side by side, holding hands between you.',
    tips: ['Walk slowly towards the camera', 'Look at each other, not the lens', 'Swing your hands a little'],
    figures: [
      { hip: [30, 88], lArm: [-12, -6], rArm: [9, 9], head: 176 },
      { hip: [70, 88], lArm: [-9, -9], rArm: [12, 6], head: 184 },
    ],
  },
  {
    id: 'power-duo', name: 'Power Duo', category: 'couple', difficulty: 'Easy',
    description: 'Both standing tall with folded arms — great for teams and partners.',
    tips: ['Stand shoulder to shoulder', 'Same pose, same attitude', 'Try back to back too'],
    figures: [
      { hip: [31, 88], ...ARMS_CROSSED },
      { hip: [69, 88], ...ARMS_CROSSED },
    ],
  },
  {
    id: 'reach-together', name: 'Reach Together', category: 'couple', difficulty: 'Easy',
    description: 'Raise your inside arms and touch hands high above you.',
    tips: ['Touch fingertips at the top', 'Smile at each other', 'Lovely at sunset as a silhouette'],
    figures: [
      { hip: [30, 88], lArm: [-12, -6], rArm: [171, 171] },
      { hip: [70, 88], lArm: [-171, -171], rArm: [12, 6] },
    ],
  },
  {
    id: 'shoulder-hug', name: 'Shoulder Hug', category: 'couple', difficulty: 'Easy',
    description: 'One arm around the shoulders, the other around the waist.',
    tips: ['Stand close together', 'Lean your heads in', 'Laugh together for a natural look'],
    figures: [
      { hip: [34, 88], head: 172, lArm: [-12, -6], rArm: [80, 100, 1, 0.45] },
      { hip: [66, 88], head: 195, lArm: [-30, -95, 1, 0.6], rArm: [12, 6] },
    ],
  },

  // ------------------------------------------------------------------ Group
  {
    id: 'group-hug', name: 'Squad Line-up', category: 'group', difficulty: 'Easy',
    description: 'Three friends with arms around each other\'s shoulders.',
    tips: ['Tallest person in the middle', 'Squeeze in close', 'Count to three and laugh'],
    figures: [
      { hip: [20, 88], scale: 0.8, head: 172, lArm: [-12, -6], rArm: [80, 95] },
      { hip: [50, 88], scale: 0.8, lArm: [-80, -95], rArm: [80, 95] },
      { hip: [80, 88], scale: 0.8, head: 188, lArm: [-80, -95], rArm: [12, 6] },
    ],
  },
  {
    id: 'group-jump', name: 'Group Jump', category: 'group', difficulty: 'Hard',
    description: 'Everyone jumps at the same time with arms in the air.',
    tips: ['Use the 10 s timer or burst', 'Shout "1, 2, 3, jump!"', 'Take lots of tries'],
    figures: [
      { hip: [20, 80], scale: 0.75, lArm: [-150, -160], rArm: [150, 160], lLeg: [-20, -10], rLeg: [10, 30] },
      { hip: [50, 76], scale: 0.75, lArm: [-140, -145], rArm: [140, 145], lLeg: [-30, -35], rLeg: [30, 35] },
      { hip: [80, 80], scale: 0.75, lArm: [-150, -160], rArm: [150, 160], lLeg: [-10, -30], rLeg: [20, 10] },
    ],
  },
];

module.exports = { CATEGORIES, POSES };
